ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS location TEXT;

CREATE TABLE IF NOT EXISTS public_visitor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  location TEXT,
  visitor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_visitor_created_at ON public_visitor (created_at DESC);
ALTER TABLE public_visitor ENABLE ROW LEVEL SECURITY;
