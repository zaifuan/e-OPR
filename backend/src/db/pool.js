const { Pool, types } = require('pg');
const env = require('../config/env');

// Lalai node-postgres menukar column DATE kepada objek JS Date (yang kemudian
// bersiri sebagai timestamp ISO penuh "2026-01-14T00:00:00.000Z" apabila
// JSON.stringify - bukan sahaja tidak kemas tetapi juga membuka risiko isu
// timezone yang sama seperti pengiraan Hari. OID 1082 = tipittre "date" -
// pulangkan sebagai string mentah "YYYY-MM-DD" terus daripada wire protocol.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Ralat pada idle client tidak boleh menjatuhkan seluruh proses
  console.error('[db] Ralat luar jangka pada idle client:', err);
});

module.exports = pool;
