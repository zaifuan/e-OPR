-- Kemas Kini 3: Duplicate & Edit OPR - rujukan sumber pendua (audit sahaja).
--
-- Additive + selamat: satu lajur NULLABLE tanpa nilai lalai; rekod sedia ada
-- kekal NULL (tiada UPDATE). Tiada DROP/TRUNCATE/DELETE.
--
-- duplicated_from_id = ID OPR sumber apabila rekod dijana melalui "Duplicate &
-- Edit". Ia HANYA jejak audit - rekod pendua kekal OPR bebas sepenuhnya
-- (ID, PDF, Versi 1, token Edit 24 Jam dan tempoh sendiri). Statistik mengira
-- setiap baris opr_records sekali, jadi sumber & pendua ialah DUA laporan.
--
-- ON DELETE SET NULL (BUKAN CASCADE): memadam OPR sumber TIDAK memadam pendua;
-- rujukan sahaja dikosongkan.
ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS duplicated_from_id INTEGER
    REFERENCES opr_records(id) ON DELETE SET NULL;

-- Indeks separa: mempercepat semakan FK semasa OPR sumber dipadam.
CREATE INDEX IF NOT EXISTS idx_opr_records_duplicated_from
  ON opr_records (duplicated_from_id) WHERE duplicated_from_id IS NOT NULL;

-- ROLLBACK (manual, hanya jika perlu - membuang jejak audit pendua sahaja):
--   DROP INDEX IF EXISTS idx_opr_records_duplicated_from;
--   ALTER TABLE opr_records DROP COLUMN IF EXISTS duplicated_from_id;
--   DELETE FROM _migrations WHERE filename = '009_opr_duplicated_from.sql';
