-- Kemas Kini 6: benarkan 10 ID design (4 KK5 + 6 KK6).
-- Hanya menggantikan CHECK constraint migrasi 011 (4 ID) dengan 10 ID.
--  - Tiada perubahan lajur: design_id kekal NOT NULL DEFAULT 'original'.
--  - Tiada UPDATE/DELETE/DROP TABLE; rekod & versi sedia ada tidak disentuh.
--    PostgreSQL mengesahkan semula semua baris sedia ada semasa ADD CONSTRAINT
--    (semua menggunakan 4 ID lama -> sah).
--  - 'random' (pilihan borang) TETAP ditolak - bukan design sebenar.
--  - Idempotent: DROP CONSTRAINT IF EXISTS + ADD (selamat dijalankan semula).
--    Sistem migrasi (migrate.js) menjalankan fail ini SEKALI dalam transaksi.
--
-- TURUTAN DEPLOY: jalankan migrasi ini dengan IMEJ BAHARU (docker compose run)
-- SEBELUM container aplikasi KK6 diaktifkan. Kod KK5 yang masih berjalan
-- serasi dengan constraint 10 ID (superset 4 ID).

ALTER TABLE opr_records DROP CONSTRAINT IF EXISTS opr_records_design_id_check;
ALTER TABLE opr_records ADD CONSTRAINT opr_records_design_id_check
  CHECK (design_id IN ('original', 'corporate', 'nature', 'royal',
                       'ocean', 'burgundy', 'forest', 'midnight', 'terracotta', 'graphite'));

ALTER TABLE opr_versions DROP CONSTRAINT IF EXISTS opr_versions_design_id_check;
ALTER TABLE opr_versions ADD CONSTRAINT opr_versions_design_id_check
  CHECK (design_id IN ('original', 'corporate', 'nature', 'royal',
                       'ocean', 'burgundy', 'forest', 'midnight', 'terracotta', 'graphite'));

-- ROLLBACK DB: JANGAN pulihkan constraint 4 ID jika ada rekod/versi yang
-- menggunakan 6 ID baharu (ADD CONSTRAINT akan gagal / data perlu dipindah).
-- Semak: SELECT design_id, count(*) FROM opr_versions GROUP BY 1;
-- Constraint 10 ID ini selamat dikekalkan walaupun aplikasi di-rollback ke KK5.
