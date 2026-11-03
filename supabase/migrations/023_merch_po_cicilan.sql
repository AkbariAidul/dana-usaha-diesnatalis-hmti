-- Migration: Tambah tabel riwayat cicilan PO
-- Menyimpan setiap transaksi cicilan yang dibayar oleh pemesan

CREATE TABLE IF NOT EXISTS merch_po_cicilan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES merch_po(id) ON DELETE CASCADE,
  no_transaksi TEXT NOT NULL,
  tanggal_bayar TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  nominal NUMERIC(12,2) NOT NULL,
  metode TEXT NOT NULL DEFAULT 'QRIS',
  bukti_url TEXT,
  validated BOOLEAN NOT NULL DEFAULT false,
  validated_by TEXT,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index untuk query cepat berdasarkan PO
CREATE INDEX IF NOT EXISTS idx_merch_po_cicilan_po_id ON merch_po_cicilan(po_id);
CREATE INDEX IF NOT EXISTS idx_merch_po_cicilan_validated ON merch_po_cicilan(validated) WHERE validated = true;

-- Insert sample data jika diperlukan
-- INSERT INTO merch_po_cicilan (po_id, nominal, metode) VALUES (..., 100000, 'QRIS');
