const path = require('path');
const env = require('../config/env');

// Pertahanan berlapis (Bahagian 24): walaupun pdf_path SENTIASA datang daripada
// DB (bukan terus daripada URL/pengguna), kita tetap sahkan hasil resolve masih
// berada dalam root storan PDF sebelum digunakan.
function resolveSafePdfPath(relativePath) {
  const root = path.resolve(env.PDF_STORAGE_PATH);
  const resolved = path.resolve(root, relativePath);
  const withSep = root.endsWith(path.sep) ? root : root + path.sep;

  if (resolved !== root && !resolved.startsWith(withSep)) {
    throw new Error(`Path traversal dikesan: ${relativePath}`);
  }
  return resolved;
}

// Nama muat turun mesra pengguna sahaja - filename dalaman (pdf_filename) kekal
// tidak berubah. "Majlis Anugerah Juara SISKAS" -> "OPR-Majlis-Anugerah-Juara-SISKAS.pdf"
function buildDownloadFilename(programName) {
  const sanitized = programName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `OPR-${sanitized || 'Program'}.pdf`;
}

module.exports = { resolveSafePdfPath, buildDownloadFilename };
