-- Fasa 1: Project Foundation
-- Skema minimum yang dipersetujui (Fasa 0) — tiada user_id / akaun guru.

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opr_records (
  id            SERIAL PRIMARY KEY,
  program_name  VARCHAR(255) NOT NULL,
  program_date  DATE         NOT NULL,
  prepared_by   VARCHAR(150) NOT NULL,
  pdf_filename  VARCHAR(255) NOT NULL,
  pdf_path      TEXT         NOT NULL,
  generated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Sokongan carian pantas ikut nama program (Bahagian 25/46 spesifikasi asal)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_opr_program_name_trgm
  ON opr_records USING gin (program_name gin_trgm_ops);

-- Nota: jadual "session" untuk Admin login dicipta secara automatik oleh
-- connect-pg-simple (createTableIfMissing: true) — tidak perlu migration berasingan.
