-- 035_session_revocation.sql
-- Tabel untuk melacak session token yang sudah dicabut (logout semua device).
-- Setiap kali user logout dari "semua perangkat", JTI baru di-insert ke tabel ini.
-- Session verify akan menolak token dengan JTI yang ada di daftar ini.
CREATE TABLE IF NOT EXISTS dashboard_session_jti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jti TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dashboard_session_jti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access session jti" ON dashboard_session_jti;
CREATE POLICY "Admin full access session jti" ON dashboard_session_jti FOR ALL USING (true);
