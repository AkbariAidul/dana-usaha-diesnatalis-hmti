-- Fix foreign key cascade chain: checkin_log → tiket_issued → pesanan_tiket → tiket_tipe
-- When deleting a ticket type, cascade delete orders, issued tickets, and check-in logs.

ALTER TABLE checkin_log
  DROP CONSTRAINT IF EXISTS checkin_log_tiket_issued_id_fkey,
  ADD CONSTRAINT checkin_log_tiket_issued_id_fkey
    FOREIGN KEY (tiket_issued_id) REFERENCES tiket_issued(id) ON DELETE CASCADE;
