-- Kemas Kini 5: pemilihan reka bentuk (design) OPR.
--
-- design_id = design SEBENAR yang digunakan untuk menjana PDF:
--   'original' | 'corporate' | 'nature' | 'royal'
-- Pilihan borang "random" TIDAK PERNAH disimpan - backend menyelesaikannya
-- kepada salah satu daripada empat ID di atas SEKALI ketika OPR baharu dijana.
--
-- Additive + selamat:
--   - Lajur NOT NULL DEFAULT 'original' (fast default PostgreSQL 11+, tiada
--     penulisan semula jadual). Semua rekod & versi sedia ada = 'original' -
--     tepat, kerana semua PDF sebelum KK5 dijana dengan reka bentuk asal.
--   - Tiada UPDATE/DELETE/DROP; PDF lama tidak dijana semula.
--   - CHECK constraint menghadkan nilai kepada 4 ID sah (pertahanan berlapis
--     selain validasi aplikasi). Ditambah secara idempotent (DO block).
--
-- opr_records.design_id  : design versi AKTIF (dibaca oleh carian/Edit/Duplicate)
-- opr_versions.design_id : design setiap versi PDF (sejarah/audit)

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS design_id VARCHAR(20) NOT NULL DEFAULT 'original';

ALTER TABLE opr_versions
  ADD COLUMN IF NOT EXISTS design_id VARCHAR(20) NOT NULL DEFAULT 'original';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opr_records_design_id_check') THEN
    ALTER TABLE opr_records ADD CONSTRAINT opr_records_design_id_check
      CHECK (design_id IN ('original', 'corporate', 'nature', 'royal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opr_versions_design_id_check') THEN
    ALTER TABLE opr_versions ADD CONSTRAINT opr_versions_design_id_check
      CHECK (design_id IN ('original', 'corporate', 'nature', 'royal'));
  END IF;
END $$;

-- ROLLBACK (manual, hanya jika perlu):
--   ALTER TABLE opr_records DROP CONSTRAINT IF EXISTS opr_records_design_id_check;
--   ALTER TABLE opr_versions DROP CONSTRAINT IF EXISTS opr_versions_design_id_check;
--   ALTER TABLE opr_records DROP COLUMN IF EXISTS design_id;
--   ALTER TABLE opr_versions DROP COLUMN IF EXISTS design_id;
--   DELETE FROM _migrations WHERE filename = '011_opr_design_selection.sql';
-- Kod KK4 mengabaikan lajur ini; rollback DB tidak diperlukan untuk rollback aplikasi.
