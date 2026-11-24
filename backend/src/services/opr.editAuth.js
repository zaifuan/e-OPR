const crypto = require('crypto');
const adminService = require('./admin.service');

// Kemas Kini 2: kebenaran suntingan OPR tanpa akaun guru.
//
// - Token rahsia 256-bit (crypto.randomBytes) dijana SEKALI ketika penjanaan
//   pertama dan dipulangkan kepada pelayar guru sahaja (respons POST /api/opr).
// - Server menyimpan HASH SHA-256 sahaja (edit_token_hash). Token asal tidak
//   pernah disimpan, dilog, atau dipulangkan oleh mana-mana API lain.
// - Token dihantar melalui header X-OPR-Edit-Token (bukan query string) -
//   tidak muncul dalam log akses/URL PDF/Referer.
// - Token terikat kepada SATU OPR (hash disimpan pada baris OPR itu) - tidak
//   boleh digunakan untuk OPR lain walaupun ID dimanipulasi.
// - Admin menggunakan sesi log masuk sedia ada (req.session.adminId) yang
//   disahkan semula terhadap jadual admins (aktif sahaja).
// - Tempoh 24 jam dikuatkuasakan berasingan oleh pemanggil menggunakan jam DB.

const TOKEN_HEADER = 'x-opr-edit-token';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bait base64url tanpa padding

function generateEditToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashEditToken(token) };
}

function hashEditToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function readTokenFromRequest(req) {
  const raw = req.get(TOKEN_HEADER);
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  return TOKEN_RE.test(token) ? token : null;
}

// Perbandingan masa-tetap (elak timing attack) antara hash token yang
// dikemukakan dan hash tersimpan.
function tokenMatches(token, storedHash) {
  if (!token || typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const a = Buffer.from(hashEditToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Admin aktif berdasarkan sesi, atau null.
async function getSessionAdmin(req) {
  const adminId = req.session && req.session.adminId;
  if (!adminId) return null;
  try {
    return await adminService.findById(adminId);
  } catch {
    return null;
  }
}

// Tentukan pihak yang meminta: { kind: 'admin', adminId } | { kind: 'token' } | null.
// `record` mesti mengandungi edit_token_hash.
async function resolveEditor(req, record) {
  const token = readTokenFromRequest(req);
  if (token && tokenMatches(token, record.edit_token_hash)) {
    return { kind: 'token', adminId: null };
  }
  const admin = await getSessionAdmin(req);
  if (admin) return { kind: 'admin', adminId: admin.id };
  return null;
}

module.exports = {
  TOKEN_HEADER,
  generateEditToken,
  hashEditToken,
  readTokenFromRequest,
  tokenMatches,
  getSessionAdmin,
  resolveEditor,
};
