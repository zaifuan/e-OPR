-- Fasa Rekod OPR v4: tambah metadata Anjuran untuk filtering.
-- Additive sahaja - tidak sentuh data/jadual sedia ada. Rekod lama akan
-- mempunyai organizer=NULL (tiada cara mengesan Anjuran rekod lama tanpa
-- membuka semula PDF, yang mana arahan asal melarang - Bahagian H).

ALTER TABLE opr_records
  ADD COLUMN IF NOT EXISTS organizer VARCHAR(50);
