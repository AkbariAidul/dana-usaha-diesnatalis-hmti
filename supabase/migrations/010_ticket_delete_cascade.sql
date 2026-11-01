-- Fix foreign key: allow deleting ticket types even when there are orders
-- This cascades deletion of orders (and their issued tickets) when a ticket type is deleted.

ALTER TABLE pesanan_tiket
  DROP CONSTRAINT IF EXISTS pesanan_tiket_tiket_tipe_id_fkey,
  ADD CONSTRAINT pesanan_tiket_tiket_tipe_id_fkey
    FOREIGN KEY (tiket_tipe_id) REFERENCES tiket_tipe(id) ON DELETE CASCADE;
