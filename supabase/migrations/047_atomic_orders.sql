-- 047_atomic_orders.sql
-- Nomor pesanan atomik, idempotensi checkout, dan RPC transaksional untuk
-- tiket, PO merchandise, paket combo, dan pendaftaran tenant.
--
-- Semua validasi kuota/slot dilakukan di dalam transaksi dengan row lock
-- (SELECT ... FOR UPDATE) agar dua checkout bersamaan tidak bisa oversell.

-- ============================================================
-- 1) Counter nomor pesanan
-- ============================================================
CREATE TABLE IF NOT EXISTS order_counter (
  prefix TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_order_number(p_prefix TEXT, p_pad INT DEFAULT 4)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_value BIGINT;
BEGIN
  INSERT INTO order_counter (prefix, value)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE SET value = order_counter.value + 1
  RETURNING value INTO v_value;
  RETURN p_prefix || '-' || lpad(v_value::TEXT, p_pad, '0');
END;
$$;

-- Seed dari data lama supaya nomor baru tidak bentrok.
INSERT INTO order_counter (prefix, value)
SELECT 'TK', COALESCE(MAX((substring(no_pesanan from '(\d+)$'))::BIGINT), 0)
FROM pesanan_tiket WHERE no_pesanan ~ '\d+$'
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_counter (prefix, value)
SELECT 'PO', COALESCE(MAX((substring(no_po from '(\d+)$'))::BIGINT), 0)
FROM merch_po WHERE no_po ~ '\d+$'
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_counter (prefix, value)
SELECT 'BD', COALESCE(MAX((substring(no_pesanan from '(\d+)$'))::BIGINT), 0)
FROM bundle_order WHERE no_pesanan ~ '\d+$'
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_counter (prefix, value)
SELECT 'TP', COALESCE(MAX((substring(kode_pendaftaran from '(\d+)$'))::BIGINT), 0)
FROM pendaftaran_tenant_pub WHERE kode_pendaftaran ~ '\d+$'
ON CONFLICT (prefix) DO NOTHING;

-- ============================================================
-- 2) Idempotensi checkout
-- ============================================================
ALTER TABLE pesanan_tiket ADD COLUMN IF NOT EXISTS idempotency_key UUID;
ALTER TABLE merch_po ADD COLUMN IF NOT EXISTS idempotency_key UUID;
ALTER TABLE bundle_order ADD COLUMN IF NOT EXISTS idempotency_key UUID;
ALTER TABLE pendaftaran_tenant_pub ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS pesanan_tiket_idempotency_idx
  ON pesanan_tiket (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS merch_po_idempotency_idx
  ON merch_po (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bundle_order_idempotency_idx
  ON bundle_order (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pendaftaran_tenant_idempotency_idx
  ON pendaftaran_tenant_pub (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 3) Tiket
-- ============================================================
CREATE OR REPLACE FUNCTION create_tiket_order(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing pesanan_tiket;
  v_tipe tiket_tipe;
  v_pending BIGINT;
  v_sisa BIGINT;
  v_no TEXT;
  v_order pesanan_tiket;
  v_jumlah INT := COALESCE((p_payload->>'jumlah')::INT, 1);
  v_idem UUID := NULLIF(p_payload->>'idempotency_key', '')::UUID;
BEGIN
  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('idem:' || v_idem::TEXT));
    SELECT * INTO v_existing FROM pesanan_tiket WHERE idempotency_key = v_idem LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('order', to_jsonb(v_existing), 'existing', true);
    END IF;
  END IF;

  SELECT * INTO v_tipe FROM tiket_tipe WHERE id = (p_payload->>'tiket_tipe_id')::UUID FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipe tiket tidak ditemukan';
  END IF;

  IF COALESCE(v_tipe.kuota, 0) > 0 THEN
    SELECT COALESCE(SUM(jumlah), 0) INTO v_pending
    FROM pesanan_tiket
    WHERE tiket_tipe_id = v_tipe.id AND status = 'menunggu_verifikasi';
    v_sisa := v_tipe.kuota - COALESCE(v_tipe.terjual, 0) - v_pending;
    IF v_jumlah > v_sisa THEN
      RAISE EXCEPTION 'Sisa tiket %', GREATEST(v_sisa, 0);
    END IF;
  END IF;

  v_no := next_order_number('TK');

  INSERT INTO pesanan_tiket (
    no_pesanan, nama_pembeli, kontak, email, tiket_tipe_id, jumlah,
    harga_satuan, diskon_persen, total, status, idempotency_key
  ) VALUES (
    v_no,
    p_payload->>'nama_pembeli',
    p_payload->>'kontak',
    NULLIF(p_payload->>'email', ''),
    v_tipe.id,
    v_jumlah,
    COALESCE((p_payload->>'harga_satuan')::NUMERIC, 0),
    COALESCE((p_payload->>'diskon_persen')::NUMERIC, 0),
    COALESCE((p_payload->>'total')::NUMERIC, 0),
    'menunggu_verifikasi',
    v_idem
  ) RETURNING * INTO v_order;

  RETURN jsonb_build_object('order', to_jsonb(v_order), 'existing', false);
END;
$$;

-- ============================================================
-- 4) PO merchandise
-- ============================================================
CREATE OR REPLACE FUNCTION create_po_order(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing merch_po;
  v_no TEXT;
  v_order merch_po;
  v_items JSONB := COALESCE(p_payload->'items', '[]'::JSONB);
  v_idem UUID := NULLIF(p_payload->>'idempotency_key', '')::UUID;
  v_ids UUID[];
  v_mid UUID;
  v_qty INT;
  v_sold BIGINT;
  v_stok INT;
  v_unlimited BOOLEAN;
  v_nama TEXT;
BEGIN
  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal satu produk';
  END IF;

  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('idem:' || v_idem::TEXT));
    SELECT * INTO v_existing FROM merch_po WHERE idempotency_key = v_idem LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('order', to_jsonb(v_existing), 'existing', true);
    END IF;
  END IF;

  SELECT array_agg(DISTINCT (i->>'merchandise_id')::UUID ORDER BY (i->>'merchandise_id')::UUID)
  INTO v_ids
  FROM jsonb_array_elements(v_items) i;

  PERFORM 1 FROM merchandise WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE;
  IF (SELECT COUNT(*) FROM merchandise WHERE id = ANY(v_ids)) <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Produk tidak tersedia';
  END IF;

  FOR v_mid, v_qty IN
    SELECT (i->>'merchandise_id')::UUID, SUM(COALESCE((i->>'qty')::INT, 1))::INT
    FROM jsonb_array_elements(v_items) i
    GROUP BY 1
  LOOP
    SELECT po_stok, po_unlimited, nama INTO v_stok, v_unlimited, v_nama
    FROM merchandise WHERE id = v_mid;

    IF NOT COALESCE(v_unlimited, true) THEN
      SELECT COALESCE(SUM(pi.qty), 0) INTO v_sold
      FROM merch_po_item pi
      JOIN merch_po p ON p.id = pi.po_id
      WHERE pi.merchandise_id = v_mid
        AND p.status IN ('menunggu_verifikasi', 'dp_diterima', 'lunas');

      IF v_qty > (COALESCE(v_stok, 0) - v_sold) THEN
        RAISE EXCEPTION 'Slot pre-order tidak cukup untuk %', v_nama;
      END IF;
    END IF;
  END LOOP;

  v_no := next_order_number('PO');

  INSERT INTO merch_po (
    no_po, nama_pemesan, kontak, email, tipe_pemesan, pengurus_id,
    harga_per_item, total, sudah_dibayar, status, pembayaran_metode,
    pembayaran_tipe, idempotency_key
  ) VALUES (
    v_no,
    p_payload->>'nama_pemesan',
    p_payload->>'kontak',
    NULLIF(p_payload->>'email', ''),
    COALESCE(p_payload->>'tipe_pemesan', 'Umum'),
    NULLIF(p_payload->>'pengurus_id', '')::UUID,
    0,
    COALESCE((p_payload->>'total')::NUMERIC, 0),
    0,
    'menunggu_verifikasi',
    COALESCE(p_payload->>'pembayaran_metode', 'QRIS'),
    COALESCE(p_payload->>'pembayaran_tipe', 'lunas'),
    v_idem
  ) RETURNING * INTO v_order;

  INSERT INTO merch_po_item (
    po_id, merchandise_id, varian_id, ukuran, warna, lengan, qty,
    harga_satuan, diskon, subtotal
  )
  SELECT
    v_order.id,
    (i->>'merchandise_id')::UUID,
    NULLIF(i->>'varian_id', '')::UUID,
    NULLIF(i->>'ukuran', ''),
    NULLIF(i->>'warna', ''),
    NULLIF(i->>'lengan', ''),
    COALESCE((i->>'qty')::INT, 1),
    COALESCE((i->>'harga_satuan')::NUMERIC, 0),
    COALESCE((i->>'diskon')::NUMERIC, 0),
    COALESCE((i->>'subtotal')::NUMERIC, 0)
  FROM jsonb_array_elements(v_items) i;

  RETURN jsonb_build_object('order', to_jsonb(v_order), 'existing', false);
END;
$$;

-- ============================================================
-- 5) Paket combo
-- ============================================================
CREATE OR REPLACE FUNCTION create_bundle_order(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing bundle_order;
  v_bundle bundle;
  v_no TEXT;
  v_order bundle_order;
  v_idem UUID := NULLIF(p_payload->>'idempotency_key', '')::UUID;
  v_tiket_items JSONB := COALESCE(p_payload->'tiket_items', '[]'::JSONB);
  v_merch_items JSONB := COALESCE(p_payload->'merch_items', '[]'::JSONB);
  v_snapshot JSONB := COALESCE(p_payload->'snapshot', '[]'::JSONB);
  v_tiket JSONB;
  v_tiket_id UUID;
  v_tiket_ids UUID[] := ARRAY[]::UUID[];
  v_merch_po_id UUID;
  v_terpakai BIGINT;
  v_ids UUID[];
  v_tipe_ids UUID[];
  v_mid UUID;
  v_qty INT;
  v_sold BIGINT;
  v_stok INT;
  v_unlimited BOOLEAN;
  v_nama TEXT;
  v_tipe tiket_tipe;
  v_tipe_id UUID;
  v_pending BIGINT;
  v_sisa BIGINT;
BEGIN
  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('idem:' || v_idem::TEXT));
    SELECT * INTO v_existing FROM bundle_order WHERE idempotency_key = v_idem LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('order', to_jsonb(v_existing), 'existing', true);
    END IF;
  END IF;

  SELECT * INTO v_bundle FROM bundle WHERE id = (p_payload->>'bundle_id')::UUID FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak ditemukan';
  END IF;
  IF NOT v_bundle.aktif THEN
    RAISE EXCEPTION 'Paket tidak aktif';
  END IF;
  IF v_bundle.tgl_mulai IS NOT NULL AND now() < v_bundle.tgl_mulai THEN
    RAISE EXCEPTION 'Paket belum dibuka';
  END IF;
  IF v_bundle.tgl_selesai IS NOT NULL AND now() > v_bundle.tgl_selesai THEN
    RAISE EXCEPTION 'Paket sudah berakhir';
  END IF;

  IF COALESCE(v_bundle.kuota, 0) > 0 THEN
    SELECT COUNT(*) INTO v_terpakai
    FROM bundle_order
    WHERE bundle_id = v_bundle.id AND status IN ('menunggu_verifikasi', 'lunas');
    IF v_terpakai >= v_bundle.kuota THEN
      RAISE EXCEPTION 'Kuota paket sudah habis';
    END IF;
  END IF;

  SELECT array_agg(DISTINCT (i->>'tipe_id')::UUID ORDER BY (i->>'tipe_id')::UUID)
  INTO v_tipe_ids FROM jsonb_array_elements(v_tiket_items) i;
  IF v_tipe_ids IS NOT NULL AND array_length(v_tipe_ids, 1) > 0 THEN
    PERFORM 1 FROM tiket_tipe WHERE id = ANY(v_tipe_ids) ORDER BY id FOR UPDATE;
    IF (SELECT COUNT(*) FROM tiket_tipe WHERE id = ANY(v_tipe_ids)) <> array_length(v_tipe_ids, 1) THEN
      RAISE EXCEPTION 'Tipe tiket pada paket tidak ditemukan';
    END IF;
  END IF;

  SELECT array_agg(DISTINCT (i->>'merchandise_id')::UUID ORDER BY (i->>'merchandise_id')::UUID)
  INTO v_ids FROM jsonb_array_elements(v_merch_items) i;
  IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
    PERFORM 1 FROM merchandise WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE;
    IF (SELECT COUNT(*) FROM merchandise WHERE id = ANY(v_ids)) <> array_length(v_ids, 1) THEN
      RAISE EXCEPTION 'Produk pada paket tidak tersedia';
    END IF;
  END IF;

  FOR v_tipe_id, v_qty IN
    SELECT (i->>'tipe_id')::UUID, SUM(COALESCE((i->>'qty')::INT, 1))::INT
    FROM jsonb_array_elements(v_tiket_items) i
    GROUP BY 1
  LOOP
    SELECT * INTO v_tipe FROM tiket_tipe WHERE id = v_tipe_id;
    IF COALESCE(v_tipe.kuota, 0) > 0 THEN
      SELECT COALESCE(SUM(jumlah), 0) INTO v_pending
      FROM pesanan_tiket
      WHERE tiket_tipe_id = v_tipe.id AND status = 'menunggu_verifikasi';
      v_sisa := v_tipe.kuota - COALESCE(v_tipe.terjual, 0) - v_pending;
      IF v_qty > v_sisa THEN
        RAISE EXCEPTION 'Sisa tiket % tinggal %', v_tipe.nama, GREATEST(v_sisa, 0);
      END IF;
    END IF;
  END LOOP;

  FOR v_mid, v_qty IN
    SELECT (i->>'merchandise_id')::UUID, SUM(COALESCE((i->>'qty')::INT, 1))::INT
    FROM jsonb_array_elements(v_merch_items) i
    GROUP BY 1
  LOOP
    SELECT po_stok, po_unlimited, nama INTO v_stok, v_unlimited, v_nama
    FROM merchandise WHERE id = v_mid;

    IF NOT COALESCE(v_unlimited, true) THEN
      SELECT COALESCE(SUM(pi.qty), 0) INTO v_sold
      FROM merch_po_item pi
      JOIN merch_po p ON p.id = pi.po_id
      WHERE pi.merchandise_id = v_mid
        AND p.status IN ('menunggu_verifikasi', 'dp_diterima', 'lunas');

      IF v_qty > (COALESCE(v_stok, 0) - v_sold) THEN
        RAISE EXCEPTION 'Slot pre-order tidak cukup untuk %', v_nama;
      END IF;
    END IF;
  END LOOP;

  v_no := next_order_number('BD');

  INSERT INTO bundle_order (
    no_pesanan, bundle_id, nama_pembeli, kontak, email, total, status, idempotency_key
  ) VALUES (
    v_no,
    v_bundle.id,
    p_payload->>'nama_pembeli',
    p_payload->>'kontak',
    NULLIF(p_payload->>'email', ''),
    COALESCE((p_payload->>'total')::NUMERIC, 0),
    'menunggu_verifikasi',
    v_idem
  ) RETURNING * INTO v_order;

  FOR v_tiket IN SELECT value FROM jsonb_array_elements(v_tiket_items)
  LOOP
    INSERT INTO pesanan_tiket (
      no_pesanan, nama_pembeli, kontak, email, tiket_tipe_id, jumlah,
      harga_satuan, diskon_persen, total, status, bundle_order_id
    ) VALUES (
      next_order_number('TK'),
      v_order.nama_pembeli,
      v_order.kontak,
      v_order.email,
      (v_tiket->>'tipe_id')::UUID,
      COALESCE((v_tiket->>'qty')::INT, 1),
      COALESCE((v_tiket->>'harga_satuan')::NUMERIC, 0),
      0,
      COALESCE((v_tiket->>'harga_satuan')::NUMERIC, 0) * COALESCE((v_tiket->>'qty')::INT, 1),
      'menunggu_verifikasi',
      v_order.id
    ) RETURNING id INTO v_tiket_id;
    v_tiket_ids := array_append(v_tiket_ids, v_tiket_id);
  END LOOP;

  IF jsonb_array_length(v_merch_items) > 0 THEN
    INSERT INTO merch_po (
      no_po, nama_pemesan, kontak, email, tipe_pemesan, harga_per_item, total,
      sudah_dibayar, status, pembayaran_metode, pembayaran_tipe, bundle_order_id
    ) VALUES (
      next_order_number('PO'),
      v_order.nama_pembeli,
      v_order.kontak,
      v_order.email,
      'Umum',
      0,
      (SELECT COALESCE(SUM(COALESCE((i->>'subtotal')::NUMERIC, 0)), 0)
       FROM jsonb_array_elements(v_merch_items) i),
      0,
      'menunggu_verifikasi',
      'QRIS',
      'lunas',
      v_order.id
    ) RETURNING id INTO v_merch_po_id;

    INSERT INTO merch_po_item (
      po_id, merchandise_id, varian_id, ukuran, warna, lengan, qty,
      harga_satuan, diskon, subtotal
    )
    SELECT
      v_merch_po_id,
      (i->>'merchandise_id')::UUID,
      NULLIF(i->>'varian_id', '')::UUID,
      NULLIF(i->>'ukuran', ''),
      NULLIF(i->>'warna', ''),
      NULLIF(i->>'lengan', ''),
      COALESCE((i->>'qty')::INT, 1),
      COALESCE((i->>'harga_satuan')::NUMERIC, 0),
      COALESCE((i->>'diskon')::NUMERIC, 0),
      COALESCE((i->>'subtotal')::NUMERIC, 0)
    FROM jsonb_array_elements(v_merch_items) i;
  END IF;

  IF jsonb_array_length(v_snapshot) > 0 THEN
    INSERT INTO bundle_order_item (
      bundle_order_id, tipe, ref_id, nama_snapshot, qty, varian_id,
      ukuran, warna, lengan, harga_satuan, subtotal
    )
    SELECT
      v_order.id,
      i->>'tipe',
      (i->>'ref_id')::UUID,
      i->>'nama_snapshot',
      COALESCE((i->>'qty')::INT, 1),
      NULLIF(i->>'varian_id', '')::UUID,
      NULLIF(i->>'ukuran', ''),
      NULLIF(i->>'warna', ''),
      NULLIF(i->>'lengan', ''),
      COALESCE((i->>'harga_satuan')::NUMERIC, 0),
      COALESCE((i->>'subtotal')::NUMERIC, 0)
    FROM jsonb_array_elements(v_snapshot) i;
  END IF;

  UPDATE bundle_order
  SET tiket_pesanan_id = v_tiket_ids[1], merch_po_id = v_merch_po_id
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('order', to_jsonb(v_order), 'existing', false);
END;
$$;

-- ============================================================
-- 6) Pendaftaran tenant
-- ============================================================
CREATE OR REPLACE FUNCTION create_tenant_order(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing pendaftaran_tenant_pub;
  v_kategori kategori_sewa;
  v_used BIGINT;
  v_jumlah INT := COALESCE((p_payload->>'jumlah_tenant')::INT, 1);
  v_idem UUID := NULLIF(p_payload->>'idempotency_key', '')::UUID;
  v_kode TEXT;
  v_order pendaftaran_tenant_pub;
BEGIN
  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('idem:' || v_idem::TEXT));
    SELECT * INTO v_existing FROM pendaftaran_tenant_pub WHERE idempotency_key = v_idem LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('order', to_jsonb(v_existing), 'existing', true);
    END IF;
  END IF;

  SELECT * INTO v_kategori FROM kategori_sewa WHERE id = (p_payload->>'kategori_sewa_id')::UUID FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kategori sewa tidak ditemukan';
  END IF;

  IF COALESCE(v_kategori.slot_tenant, 0) > 0 THEN
    SELECT COALESCE(SUM(jumlah_tenant), 0) INTO v_used
    FROM pendaftaran_tenant_pub
    WHERE kategori_sewa_id = v_kategori.id
      AND status NOT IN ('ditolak', 'batal');
    IF v_used + v_jumlah > v_kategori.slot_tenant THEN
      RAISE EXCEPTION 'Slot kategori tersisa %', GREATEST(v_kategori.slot_tenant - v_used, 0);
    END IF;
  END IF;

  v_kode := next_order_number('TP');

  INSERT INTO pendaftaran_tenant_pub (
    kode_pendaftaran, nama_usaha, kontak, email, kategori_sewa_id, jenis_usaha,
    jenis_usaha_qty, jumlah_tenant, asal, lokasi, periode_daftar, harga_akhir,
    dp_wajib, sudah_dibayar, tgl_daftar, tgl_acara, status, alamat,
    deskripsi_usaha, addon, idempotency_key
  ) VALUES (
    v_kode,
    p_payload->>'nama_usaha',
    p_payload->>'kontak',
    NULLIF(p_payload->>'email', ''),
    v_kategori.id,
    p_payload->>'jenis_usaha',
    COALESCE(p_payload->'jenis_usaha_qty', '{}'::JSONB),
    v_jumlah,
    COALESCE(p_payload->>'asal', 'Internal Kampus'),
    p_payload->>'lokasi',
    p_payload->>'periode_daftar',
    COALESCE((p_payload->>'harga_akhir')::NUMERIC, 0),
    COALESCE((p_payload->>'dp_wajib')::NUMERIC, 0),
    0,
    COALESCE((p_payload->>'tgl_daftar')::DATE, CURRENT_DATE),
    NULLIF(p_payload->>'tgl_acara', '')::DATE,
    'menunggu_verifikasi',
    NULLIF(p_payload->>'alamat', ''),
    NULLIF(p_payload->>'deskripsi_usaha', ''),
    COALESCE(p_payload->'addon', '[]'::JSONB),
    v_idem
  ) RETURNING * INTO v_order;

  RETURN jsonb_build_object('order', to_jsonb(v_order), 'existing', false);
END;
$$;
