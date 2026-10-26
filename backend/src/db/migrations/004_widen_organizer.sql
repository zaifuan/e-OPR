-- Pembaharuan 01: Anjuran LAIN-LAIN.
-- Nama anjuran manual (maksimum 100 aksara, dikuatkuasa aplikasi) kini
-- disimpan terus sebagai nilai organizer. Column asal VARCHAR(50) (002)
-- akan menolak nama melebihi 50 aksara, jadi dilebarkan ke VARCHAR(100).
-- Additive + selamat sahaja: melebarkan VARCHAR dalam PostgreSQL tidak
-- menulis semula jadual dan tidak mengubah data sedia ada. Tiada DROP/
-- TRUNCATE/UPDATE. Rekod lama (termasuk organizer NULL) tidak terjejas.

ALTER TABLE opr_records
  ALTER COLUMN organizer TYPE VARCHAR(100);
