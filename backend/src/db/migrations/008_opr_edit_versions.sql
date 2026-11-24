-- Kemas Kini 2: Edit OPR dalam tempoh 24 jam + sejarah versi.
--
-- Additive + selamat sahaja: tiada DROP/TRUNCATE/DELETE, tiada UPDATE ke atas
-- data sedia ada. Rekod lama (sebelum Kemas Kini 2) kekal sah:
--   - edit_expires_at = NULL  -> DIKUNCI secara kekal (tiada tempoh suntingan
--     dicipta berdasarkan tarikh deployment; data borang/gambar asal juga
--     tidak pernah disimpan, jadi tiada apa boleh dipulihkan dengan jujur).
--   - edit_token_hash = NULL  -> tiada sesiapa memegang kebenaran suntingan.
--   - current_version = 1     -> nilai lalai (fast default PostgreSQL 11+,
--     tiada penulisan semula jadual).
--   - tiada baris opr_versions -> sejarah dipaparkan sebagai "Versi 1 — Asal"
--     terus daripada opr_records (tidak direka-reka ke dalam DB).
--
-- opr_records KEKAL satu baris bagi setiap OPR (ID utama tidak berubah) dan
-- sentiasa mencerminkan VERSI AKTIF (drive_file_id/pdf_filename/metadata) -
-- semua pembaca sedia ada (carian, statistik, GET /:id/pdf, PDF Viewer
-- /opr/:id/lihat) terus membaca versi terkini tanpa perubahan. Statistik
-- mengira opr_records sahaja -> satu laporan = satu kiraan walau berapa versi.

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS edit_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Setiap versi (termasuk Versi 1 asal) bagi OPR yang dijana selepas Kemas
-- Kini 2. Baris versi TIDAK PERNAH dikemas kini atau dipadam oleh aplikasi
-- (kecuali melalui CASCADE apabila Admin memadam keseluruhan OPR).
--   form_data   : snapshot input borang (JSONB) - cukup untuk memulihkan borang
--   image_files : [{"sha256":"<64 hex>"}, ...] x4 mengikut susunan dalam PDF;
--                 NULL jika gambar gagal disimpan (gambar perlu dimuat naik semula)
--   source      : 'create' (penjanaan asal) | 'edit' (pembetulan)
--   edited_by_admin_id : NULL = guru (token); nilai = Admin yang menyunting
CREATE TABLE IF NOT EXISTS opr_versions (
  id                 SERIAL PRIMARY KEY,
  opr_id             INTEGER      NOT NULL REFERENCES opr_records(id) ON DELETE CASCADE,
  version_no         INTEGER      NOT NULL CHECK (version_no >= 1),
  source             VARCHAR(10)  NOT NULL CHECK (source IN ('create', 'edit')),
  form_data          JSONB,
  image_files        JSONB,
  pdf_filename       VARCHAR(255) NOT NULL,
  drive_file_id      TEXT         NOT NULL,
  edited_by_admin_id INTEGER,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT opr_versions_opr_version_unique UNIQUE (opr_id, version_no)
);

-- UNIQUE (opr_id, version_no) sudah menyediakan indeks untuk carian ikut OPR.

-- ROLLBACK (manual, JANGAN dijalankan melainkan perlu - memadam sejarah versi):
--   DROP TABLE IF EXISTS opr_versions;
--   ALTER TABLE opr_records DROP COLUMN IF EXISTS edit_expires_at,
--     DROP COLUMN IF EXISTS edit_token_hash, DROP COLUMN IF EXISTS current_version,
--     DROP COLUMN IF EXISTS updated_at;
--   DELETE FROM _migrations WHERE filename = '008_opr_edit_versions.sql';
-- Kod versi sebelum Kemas Kini 2 TIDAK memerlukan rollback DB ini (ia
-- mengabaikan lajur/jadual baharu), KECUALI Admin delete: lihat laporan.
