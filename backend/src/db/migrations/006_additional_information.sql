-- Pembaharuan 03: LAIN-LAIN (NYATAKAN) - maklumat tambahan dinamik.
-- Setiap OPR boleh ada 0-3 set {title, content} tambahan selepas medan
-- laporan asal. Disimpan sebagai JSONB dalam satu lajur baharu pada rekod
-- yang SAMA (satu program = satu rekod), selari dengan program_schedule (005).
--
-- Bentuk data (ditulis oleh opr.archive.js; NULL jika tiada maklumat tambahan):
--   [{"title":"IMPAK","content":"1. Meningkatkan keyakinan murid.\n2. ..."},
--    {"title":"TINDAKAN SUSULAN","content":"..."}]
--
-- Additive + selamat: lajur NULLABLE tanpa nilai lalai, rekod lama kekal
-- NULL, tiada UPDATE/DROP/TRUNCATE. Tidak menyentuh organizer (004) atau
-- program_schedule (005).

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS additional_info JSONB;
