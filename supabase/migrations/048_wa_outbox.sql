-- 048_wa_outbox.sql
-- Outbox notifikasi WhatsApp: pesan yang gagal terkirim langsung disimpan di sini
-- lalu dicoba ulang oleh cron /api/cron/wa-retry dengan backoff eksponensial.
CREATE TABLE IF NOT EXISTS wa_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL,
  message TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wa_outbox_retry_idx
  ON wa_outbox (status, next_retry_at);
CREATE INDEX IF NOT EXISTS wa_outbox_created_idx
  ON wa_outbox (created_at DESC);
