WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY lower(btrim(nama))
      ORDER BY urutan NULLS LAST, created_at NULLS LAST, id
    ) AS keep_id
  FROM merch_varian
)
UPDATE merch_po_item i
SET varian_id = ranked.keep_id
FROM ranked
WHERE i.varian_id = ranked.id
  AND ranked.id <> ranked.keep_id;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY lower(btrim(nama))
      ORDER BY urutan NULLS LAST, created_at NULLS LAST, id
    ) AS keep_id
  FROM merch_varian
)
DELETE FROM merch_varian v
USING ranked
WHERE v.id = ranked.id
  AND ranked.id <> ranked.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_merch_varian_nama_key
  ON merch_varian (lower(btrim(nama)));

ALTER TABLE merchandise
  ADD COLUMN IF NOT EXISTS varian_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_merchandise_varian_ids
  ON merchandise USING GIN (varian_ids);

UPDATE merchandise m
SET varian_ids = COALESCE((
  SELECT jsonb_agg(v.id ORDER BY v.urutan, v.nama)
  FROM merch_varian v
  WHERE v.aktif = true
), '[]'::jsonb)
WHERE m.varian_ids = '[]'::jsonb;
