-- Per-product pre-order window, price, and slot settings.
ALTER TABLE merchandise
  ADD COLUMN IF NOT EXISTS harga_po NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS po_mulai TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS po_selesai TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS po_unlimited BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS po_stok INTEGER NOT NULL DEFAULT 0;

-- Link PO items and H-day transactions to the merchandise master.
ALTER TABLE merch_po_item
  ADD COLUMN IF NOT EXISTS merchandise_id UUID REFERENCES merchandise(id) ON DELETE SET NULL;

ALTER TABLE kasir_transaksi
  ADD COLUMN IF NOT EXISTS merchandise_id UUID REFERENCES merchandise(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_merch_po_item_merchandise ON merch_po_item(merchandise_id);
CREATE INDEX IF NOT EXISTS idx_kasir_transaksi_merchandise ON kasir_transaksi(merchandise_id);
