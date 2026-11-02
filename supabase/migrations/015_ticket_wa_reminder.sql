-- Track WhatsApp reminders so H-2/H-1 messages are only sent once per order.
ALTER TABLE pesanan_tiket
  ADD COLUMN IF NOT EXISTS wa_h2_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_h1_at TIMESTAMPTZ;
