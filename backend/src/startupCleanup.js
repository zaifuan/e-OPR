const fsp = require('fs/promises');
const path = require('path');
const env = require('./config/env');

// Membersihkan folder sisa dalam TEMP_STORAGE_PATH semasa app start - jika
// container crash ketika satu generation sedang diproses, cleanup try/finally
// biasa (opr.controller.js) tidak sempat berjalan, meninggalkan folder
// {request-uuid} yang tidak berguna. Dijalankan SEKALI semasa startup sahaja.
//
// SEMPADAN PENTING (Bahagian 16, Fasa 6): fungsi ini HANYA beroperasi dalam
// TEMP_STORAGE_PATH. Ia tidak pernah rujuk atau sentuh PDF_STORAGE_PATH -
// arkib PDF kekal walau apa-apa berlaku semasa startup.
async function cleanStaleTempOnStartup() {
  try {
    const entries = await fsp.readdir(env.TEMP_STORAGE_PATH, { withFileTypes: true });
    let cleaned = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue; // hanya folder {request-uuid}, bukan fail rawak
      await fsp.rm(path.join(env.TEMP_STORAGE_PATH, entry.name), { recursive: true, force: true });
      cleaned += 1;
    }

    if (cleaned > 0) {
      console.log(`[startup] Dibersihkan ${cleaned} folder temp sisa (kemungkinan daripada crash sebelumnya)`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') return; // folder belum wujud lagi - tiada apa perlu dibersihkan
    console.error('[startup] gagal semak/bersihkan TEMP_STORAGE_PATH semasa startup', err);
  }
}

module.exports = { cleanStaleTempOnStartup };
