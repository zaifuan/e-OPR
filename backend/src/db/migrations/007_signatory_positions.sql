-- Pembaharuan 04: Jawatan bagi Disediakan Oleh dan Disahkan Oleh.
-- Dua lajur teks opsyenal pada rekod yang SAMA (tiada rekod/jadual baharu).
-- Had 80 aksara dikuatkuasa aplikasi (constants/opr.js); lajur VARCHAR(100)
-- memberi ruang selamat tanpa migrasi baharu jika had dinaikkan kelak.
-- NULL = jawatan tidak diisi.
--
-- Additive + selamat: lajur NULLABLE tanpa nilai lalai, rekod lama kekal
-- NULL, tiada UPDATE/DROP/TRUNCATE. Tidak menyentuh prepared_by, organizer
-- (004), program_schedule (005) atau additional_info (006). IF NOT EXISTS
-- memastikan tiada kesan tambahan jika dijalankan semula.

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS prepared_by_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS verified_by_position VARCHAR(100);
