-- Modal (biaya gelang/wristband) per tipe tiket
ALTER TABLE tiket_tipe
  ADD COLUMN IF NOT EXISTS modal NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE tiket_tipe
  DROP CONSTRAINT IF EXISTS tiket_tipe_modal_check,
  ADD CONSTRAINT tiket_tipe_modal_check CHECK (modal >= 0);
