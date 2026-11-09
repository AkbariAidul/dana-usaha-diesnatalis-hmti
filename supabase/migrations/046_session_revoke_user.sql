-- 046_session_revoke_user.sql
-- Tabel revoke sesi butuh user_name agar "logout semua perangkat" bisa mencabut
-- semua token milik satu user (lihat src/lib/session.ts isSessionRevoked).
ALTER TABLE dashboard_session_jti ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_dashboard_session_jti_user
  ON dashboard_session_jti (user_name, created_at DESC);
