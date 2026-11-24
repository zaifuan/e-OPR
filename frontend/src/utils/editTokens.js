// Kemas Kini 2: simpanan token suntingan OPR dalam pelayar guru.
//
// Token rahsia (dipulangkan SEKALI oleh POST /api/opr) disimpan dalam
// localStorage pelayar yang menjana OPR supaya guru boleh menekan "Edit" dari
// halaman Rekod OPR dalam tempoh 24 jam tanpa log masuk. Untuk peranti lain,
// guru menggunakan "Pautan Edit" (token dalam #fragment URL - tidak dihantar
// ke server/log). Backend tetap pengesah muktamad (token + tempoh jam DB);
// masa di sini hanya untuk paparan status.

const KEY = 'eopr.editTokens.v1';
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000; // buang entri sehari selepas tamat

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // mod peribadi / storan penuh - pautan edit masih boleh digunakan
  }
}

// Offset jam server (ms) supaya paparan baki masa tidak bergantung pada jam
// telefon yang mungkin salah. Tidak menjejaskan keselamatan (backend menyemak).
export function computeServerOffset(serverTime) {
  const t = Date.parse(serverTime);
  return Number.isFinite(t) ? t - Date.now() : 0;
}

export function saveEditToken(id, { token, expiresAt, serverOffsetMs = 0 }) {
  if (!token || !expiresAt) return;
  const data = readAll();
  data[String(id)] = { token, expiresAt, serverOffsetMs };
  const now = Date.now();
  for (const [key, entry] of Object.entries(data)) {
    const exp = Date.parse(entry && entry.expiresAt);
    if (!Number.isFinite(exp) || exp + PRUNE_AFTER_MS < now + (entry.serverOffsetMs || 0)) delete data[key];
  }
  writeAll(data);
}

export function getEditEntry(id) {
  const entry = readAll()[String(id)];
  return entry && typeof entry.token === 'string' ? entry : null;
}

export function removeEditToken(id) {
  const data = readAll();
  delete data[String(id)];
  writeAll(data);
}

export function isEntryOpen(entry) {
  if (!entry) return false;
  const exp = Date.parse(entry.expiresAt);
  return Number.isFinite(exp) && Date.now() + (entry.serverOffsetMs || 0) < exp;
}

// Status suntingan bagi paparan senarai: 'editable' | 'locked'.
// Pemegang token yang belum tamat, atau Admin bagi rekod yang server
// laporkan masih dalam tempoh (edit_open - hanya dipulangkan kepada sesi Admin).
export function editStatusFor(record, isAdmin) {
  if (isEntryOpen(getEditEntry(record.id))) return 'editable';
  if (isAdmin && record.edit_open === true) return 'editable';
  return 'locked';
}

export function buildEditLink(id, token) {
  return `${window.location.origin}/opr/${id}/edit#t=${token}`;
}

// Format masa tamat dalam zon masa sekolah (Asia/Kuala_Lumpur).
export function formatMasa(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ms-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function bakiMasa(expiresAt, serverOffsetMs = 0) {
  const ms = Date.parse(expiresAt) - (Date.now() + serverOffsetMs);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const jam = Math.floor(totalMin / 60);
  const minit = totalMin % 60;
  return jam > 0 ? `${jam} jam ${minit} minit` : `${minit} minit`;
}
