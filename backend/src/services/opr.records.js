const pool = require('../db/pool');

const PAGE_SIZE = 10;
const SAFE_FIELDS = 'id, program_name, program_date, organizer, prepared_by, generated_at';

// Bina fasal WHERE dinamik dengan SELAMAT - setiap nilai pengguna dihantar
// melalui parameter ($1, $2, ...) sahaja, tidak pernah digabung terus ke
// dalam SQL string (larangan eksplisit string-concatenation).
function buildFilters({ query, year, organizer }) {
  const conditions = [];
  const params = [];

  if (query) {
    params.push(query);
    conditions.push(`program_name ILIKE '%' || $${params.length} || '%'`);
  }
  if (year) {
    params.push(year);
    conditions.push(`EXTRACT(YEAR FROM program_date) = $${params.length}`);
  }
  if (organizer) {
    params.push(organizer);
    conditions.push(`organizer = $${params.length}`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// Carian/senarai BERSATU - satu fungsi dikongsi oleh /recent dan /search
// supaya COUNT dan SELECT rekod SENTIASA guna filter yang sama (elak
// "jadual tunjuk 7 rekod tapi total kata 87").
// Susunan program_date DESC + id DESC sebagai tie-breaker deterministic -
// rekod tidak "melompat" antara halaman pagination.
async function findRecords({ query, year, organizer, page }) {
  const { where, params } = buildFilters({ query, year, organizer });
  const offset = (page - 1) * PAGE_SIZE;

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM opr_records ${where}`,
    params
  );
  const total = countRows[0].total;

  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const { rows } = await pool.query(
    `SELECT ${SAFE_FIELDS} FROM opr_records ${where}
     ORDER BY program_date DESC, id DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, PAGE_SIZE, offset]
  );

  return {
    records: rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Senarai tahun SEBENAR dalam DB (bukan hardcode) untuk isi dropdown Tahun -
// terbaru dahulu.
async function findAvailableYears() {
  const { rows } = await pool.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM program_date)::int AS year
     FROM opr_records
     ORDER BY year DESC`
  );
  return rows.map((r) => r.year);
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${SAFE_FIELDS}, drive_file_id, pdf_filename FROM opr_records WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findRecords, findAvailableYears, findById, PAGE_SIZE };
