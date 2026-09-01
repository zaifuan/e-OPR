-- Fasa Google Drive Primary Storage: Google Drive kini storan PRIMARY untuk
-- PDF OPR (bukan lagi backup optional). Additive + selamat sahaja - tiada
-- DROP TABLE/TRUNCATE/reset data.

-- drive_file_id: ID fail Google Drive untuk PDF final. SENGAJA NULLABLE di
-- peringkat DB (bukan NOT NULL constraint) - lihat penjelasan keputusan
-- dalam laporan. Ringkasnya: rekod SEDIA ADA (sebelum patch ini) tidak
-- mempunyai fail Drive sama sekali, jadi NOT NULL constraint akan
-- menggagalkan migration ini serta-merta terhadap data sedia ada. "Wajib
-- untuk rekod BAHARU" dikuatkuasakan di peringkat APLIKASI (setiap laluan
-- INSERT baharu dalam opr.archive.js sentiasa sertakan nilai - tiada
-- code path yang insert tanpanya) - bukan constraint DB.
ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

-- pdf_path tidak lagi digunakan untuk rekod baharu (Google Drive primary
-- storage, bukan local filesystem). Column KEKAL wujud (tidak di-DROP -
-- destructive, tidak diperlukan) untuk rekod sedia ada yang masih
-- merujuknya, tetapi dilonggarkan daripada NOT NULL supaya rekod baharu
-- boleh di-INSERT tanpa nilai tersebut.
ALTER TABLE opr_records
  ALTER COLUMN pdf_path DROP NOT NULL;
