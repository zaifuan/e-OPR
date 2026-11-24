const crypto = require('crypto');
const env = require('../config/env');

// Kemas Kini 3 (pembetulan audit): TIKET SUMBER DUPLICATE.
//
// Masalah asal: duplicated_from_id diterima terus daripada badan POST - sesiapa
// boleh mencipta OPR dengan jejak sumber palsu (mana-mana ID).
//
// Penyelesaian (tanpa login guru):
//   1. GET /api/opr/:id/duplicate-source (BACA, kekal awam seperti PDF OPR)
//      turut memulangkan `source_ticket` yang DITANDATANGANI server:
//        base64url(JSON {v, s: sourceId, n: nonce, e: tamat}) + "." + HMAC-SHA256
//   2. POST /api/opr menerima `duplicate_ticket` (BUKAN ID). Server mengesahkan
//      tandatangan (masa-tetap), versi, tempoh & bentuk; ID sumber diambil
//      DARIPADA TIKET sahaja. Medan `duplicated_from_id` daripada klien
//      diabaikan sepenuhnya.
//   3. Nonce tiket disimpan (unik) pada rekod baharu -> satu tiket = paling
//      banyak SATU rekod berjejak (main semula tiket -> rekod dijana tanpa jejak).
//   4. (Pembetulan akhir) Mod Duplicate adalah TEGAS: jika tiket tidak sah,
//      tamat, sudah digunakan, atau sumber sudah tiada, TIADA rekod dijana -
//      server memulangkan 409 dengan kod yang boleh dipulihkan (klien
//      memperbaharui tiket / memaparkan OPR yang sudah dijana). Tiada rekod
//      Duplicate disimpan tanpa jejak secara senyap. CREATE biasa (tiada
//      medan duplicate_ticket) tidak terjejas. Tiket TIDAK memberi sebarang
//      kebenaran lain (bukan token Edit, bukan akses baca).
//
// Pembezaan: MEMBACA OPR adalah awam (tiada perubahan). Tiket hanya
// membuktikan rekod baharu dijana melalui aliran Duplicate yang bermula
// daripada data sumber yang dikeluarkan server bagi OPR tersebut, dalam
// tempoh sah, sekali sahaja. Ia BUKAN bukti identiti pengguna (tiada akaun
// guru) - batasan ini dinyatakan dalam laporan.

const TICKET_VERSION = 1;
const TICKET_TTL_SECONDS = 24 * 60 * 60; // borang Duplicate boleh dibuka lama sebelum dihantar
const MAX_TICKET_LENGTH = 512;

// Kunci khusus (diterbitkan daripada SESSION_SECRET yang sedia ada) - tiada
// konfigurasi .env baharu; label berbeza memisahkannya daripada kegunaan sesi.
let cachedKey = null;
function ticketKey() {
  if (!cachedKey) {
    cachedKey = crypto.createHmac('sha256', env.SESSION_SECRET).update('eopr-duplicate-ticket-v1').digest();
  }
  return cachedKey;
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', ticketKey()).update(payloadB64).digest('base64url');
}

function issueDuplicateTicket(sourceId, nowMs = Date.now()) {
  const exp = Math.floor(nowMs / 1000) + TICKET_TTL_SECONDS;
  const payload = { v: TICKET_VERSION, s: sourceId, n: crypto.randomBytes(16).toString('hex'), e: exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return { ticket: `${payloadB64}.${sign(payloadB64)}`, expires_at: new Date(exp * 1000).toISOString() };
}

// Semak tiket dengan SEBAB kegagalan (untuk mesej ralat yang boleh dipulihkan):
//   { ok: true, ticket: { sourceId, nonce } } | { ok: false, reason: 'invalid' | 'expired' }
// Tandatangan disemak DAHULU - payload tiket palsu tidak pernah dipercayai,
// termasuk medan tamat tempohnya. Tidak pernah throw.
function inspectDuplicateTicket(raw, nowMs = Date.now()) {
  const invalid = { ok: false, reason: 'invalid' };
  try {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_TICKET_LENGTH) return invalid;
    const parts = raw.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return invalid;

    const expected = Buffer.from(sign(parts[0]), 'base64url');
    const given = Buffer.from(parts[1], 'base64url');
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return invalid;

    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!payload || payload.v !== TICKET_VERSION) return invalid;
    if (!Number.isInteger(payload.s) || payload.s <= 0 || payload.s > 2147483647) return invalid;
    if (typeof payload.n !== 'string' || !/^[a-f0-9]{32}$/.test(payload.n)) return invalid;
    if (!Number.isInteger(payload.e)) return invalid;
    if (payload.e * 1000 <= nowMs) return { ok: false, reason: 'expired' }; // jam server
    return { ok: true, ticket: { sourceId: payload.s, nonce: payload.n } };
  } catch {
    return invalid;
  }
}

// Bentuk ringkas (serasi): { sourceId, nonce } jika sah, selain itu null.
function verifyDuplicateTicket(raw, nowMs = Date.now()) {
  const result = inspectDuplicateTicket(raw, nowMs);
  return result.ok ? result.ticket : null;
}

module.exports = { issueDuplicateTicket, inspectDuplicateTicket, verifyDuplicateTicket, TICKET_TTL_SECONDS };
