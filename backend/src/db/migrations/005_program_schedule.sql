-- Pembaharuan 02: Pengurusan Tarikh dan Masa Fleksibel.
-- Satu OPR boleh mempunyai sehingga 5 tarikh berasingan (masa sama atau
-- berbeza). Ia KEKAL satu rekod opr_records - jadual penuh disimpan sebagai
-- JSONB dalam satu lajur baharu (bukan jadual relational berasingan: data
-- ini hanya ditulis sekali semasa jana OPR dan dibaca bersama rekodnya,
-- tidak pernah dicari/ditapis secara berasingan).
--
-- program_date KEKAL tarikh utama untuk carian/penapis Tahun/susunan, dan
-- untuk rekod tarikh berasingan ia ialah tarikh PALING AWAL.
--
-- Bentuk data (ditulis oleh opr.archive.js):
--   {"mode":"range","start_date":"2026-11-19","end_date":"2026-11-20"|null,
--    "start_time":"08:00","end_time":"10:00"}
--   {"mode":"separate","time_mode":"same"|"different",
--    "sessions":[{"date":"2026-11-19","start_time":"08:00","end_time":"10:00"}, ...]}
--
-- Additive + selamat: lajur NULLABLE, tiada nilai lalai ditulis ke rekod
-- lama (rekod lama kekal NULL), tiada UPDATE/DROP/TRUNCATE. Tidak menyentuh
-- lajur organizer (migrasi 004).

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS program_schedule JSONB;
