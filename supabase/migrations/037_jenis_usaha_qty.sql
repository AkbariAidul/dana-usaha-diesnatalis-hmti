-- 037_jenis_usaha_qty.sql
-- Simpan rincian jumlah tenant per jenis usaha (F&B / Non-F&B) agar satu
-- pendaftaran bisa menyewa beberapa tenant dengan jenis usaha berbeda.
ALTER TABLE pendaftaran_tenant_pub
  ADD COLUMN IF NOT EXISTS jenis_usaha_qty JSONB;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS jenis_usaha_qty JSONB;

UPDATE pendaftaran_tenant_pub
SET jenis_usaha_qty = CASE
  WHEN jenis_usaha = 'Non-F&B' THEN jsonb_build_object('fnb', 0, 'nonFnb', COALESCE(jumlah_tenant, 1))
  ELSE jsonb_build_object('fnb', COALESCE(jumlah_tenant, 1), 'nonFnb', 0)
END
WHERE jenis_usaha_qty IS NULL;

UPDATE tenants
SET jenis_usaha_qty = CASE
  WHEN jenis_usaha = 'Non-F&B' THEN jsonb_build_object('fnb', 0, 'nonFnb', COALESCE(jumlah_tenant, 1))
  ELSE jsonb_build_object('fnb', COALESCE(jumlah_tenant, 1), 'nonFnb', 0)
END
WHERE jenis_usaha_qty IS NULL;
