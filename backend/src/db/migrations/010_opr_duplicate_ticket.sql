-- Kemas Kini 3 (pembetulan audit): pengesahan jejak sumber Duplicate.
--
-- duplicate_ticket_nonce = nonce tiket sumber bertandatangan server yang
-- digunakan untuk menjana rekod ini (lihat services/opr.duplicateTicket.js).
-- Indeks UNIK separa memastikan satu tiket menghasilkan paling banyak SATU
-- rekod berjejak (main semula tiket tidak boleh menggandakan jejak sumber).
--
-- Additive + selamat: lajur NULLABLE tanpa nilai lalai, rekod sedia ada kekal
-- NULL, tiada UPDATE/DROP/TRUNCATE/DELETE. Tidak mengubah migrasi 009.
-- Bergantung pada 009 (duplicated_from_id) - dijalankan mengikut susunan.

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS duplicate_ticket_nonce VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS uq_opr_records_duplicate_ticket_nonce
  ON opr_records (duplicate_ticket_nonce) WHERE duplicate_ticket_nonce IS NOT NULL;

-- ROLLBACK (manual, hanya jika perlu):
--   DROP INDEX IF EXISTS uq_opr_records_duplicate_ticket_nonce;
--   ALTER TABLE opr_records DROP COLUMN IF EXISTS duplicate_ticket_nonce;
--   DELETE FROM _migrations WHERE filename = '010_opr_duplicate_ticket.sql';
