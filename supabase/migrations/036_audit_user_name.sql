-- 036_audit_user_name.sql
-- Tambah kolom user_name ke audit_log agar traceability lebih baik.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
