const {
  LIMITS,
  OTHER_ORGANIZER,
  ORGANIZER_OPTIONS,
  REQUIRED_IMAGES,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_MIME,
  MESSAGES,
  DATE_MODES,
  TIME_MODES,
  MIN_SESSIONS,
  MAX_SESSIONS,
  MAX_SESSIONS_JSON,
  MAX_ADDITIONAL_INFO,
  ADDITIONAL_INFO_TITLE_MAX,
  ADDITIONAL_INFO_CONTENT_MAX,
  MAX_ADDITIONAL_INFO_JSON,
} = require('../constants/opr');
const { detectImageType } = require('../utils/imageType');

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkText(body, errors, clean, key) {
  const raw = typeof body[key] === 'string' ? body[key].trim() : '';
  // typeof !== 'string' menutup kes parameter pollution (field dihantar berulang
  // kali menjadikannya array) - terus dianggap kosong/tidak sah.
  if (raw === '') {
    errors[key] = MESSAGES[key].required;
    return;
  }
  if (raw.length > LIMITS[key]) {
    errors[key] = MESSAGES[key].maxLength;
    return;
  }
  clean[key] = raw;
}

// Untuk field dropdown wajib (cth. Anjuran) - hanya nilai dalam senarai tetap
// diterima, bukan sekadar "tidak kosong". Sama pertahanan parameter-pollution
// seperti checkText (typeof !== 'string' -> ditolak sebagai kosong).
function checkEnum(body, errors, clean, key, allowedValues) {
  const raw = typeof body[key] === 'string' ? body[key].trim() : '';
  if (raw === '') {
    errors[key] = MESSAGES[key].required;
    return;
  }
  if (!allowedValues.includes(raw)) {
    errors[key] = MESSAGES[key].invalid;
    return;
  }
  clean[key] = raw;
}

// Field pelaporan yang kini OPSYENAL (patch v3.1 - Objektif/Ringkasan
// Aktiviti/Kekuatan/Kelemahan/Penambahbaikan). Trim + kuatkuasa had aksara
// HANYA jika diisi; whitespace-sahaja dianggap kosong (bukan content
// sebenar); kekosongan sentiasa SAH - tiada mesej "diperlukan" sekali-kali.
// Pembaharuan 01: Nama Anjuran manual (hanya apabila LAIN-LAIN dipilih).
// Sanitasi: buang aksara kawalan (cth. baris baru/tab) dan mampatkan ruang
// berturut-turut kepada satu - nama mesti satu baris kemas untuk banner PDF.
// Escape HTML dikendalikan oleh Handlebars {{organizer}} dalam template.
// Ruang kosong semata-mata dianggap tidak diisi. Had aksara disemak SELEPAS
// sanitasi supaya nilai yang disimpan/dipapar sentiasa <= 100 aksara.
function sanitizeOrganizerName(value) {
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkOrganizerOther(body, errors, clean) {
  const raw = typeof body.organizer_other === 'string' ? sanitizeOrganizerName(body.organizer_other) : '';
  if (raw === '') {
    errors.organizer_other = MESSAGES.organizer_other.required;
    return;
  }
  if (raw.length > LIMITS.organizer_other) {
    errors.organizer_other = MESSAGES.organizer_other.maxLength;
    return;
  }
  // Nilai manual menjadi organizer SEBENAR (DB + banner PDF); kategori
  // dropdown asal disimpan berasingan untuk penentuan tema warna sahaja.
  clean.organizer = raw;
}

function checkOptionalText(body, errors, clean, key) {
  const raw = typeof body[key] === 'string' ? body[key].trim() : '';
  if (raw !== '' && raw.length > LIMITS[key]) {
    errors[key] = MESSAGES[key].maxLength;
    return;
  }
  clean[key] = raw;
}

// ===================== Tarikh & Masa (Pembaharuan 02) =====================
// Struktur data borang (multipart) - sama di frontend & backend:
//   date_mode = 'range' (Tarikh Berturut-turut - fungsi asal) | 'separate'
//     range    : program_date_start, program_date_end?, start_time, end_time
//     separate : time_mode = 'same' | 'different'
//                sessions  = JSON string, 2-5 item, tersusun ikut input:
//                  same      -> [{ "date": "YYYY-MM-DD" }]   + start_time, end_time
//                  different -> [{ "date", "start_time", "end_time" }]
// date_mode TIADA dihantar -> dianggap 'range' (keserasian klien lama).
// Medan milik mod lain yang DIISI ditolak (bukan diabaikan senyap) supaya
// data tersembunyi tidak pernah mempengaruhi PDF.
//
// Hasil: clean.program_date_start = tarikh PALING AWAL (kekal program_date
// di DB untuk carian/susunan), clean.schedule = objek berstruktur untuk
// template PDF & lajur program_schedule (JSONB).

// Tarikh kalendar SEBENAR (cth. 2026-02-30 ditolak) - bukan sekadar regex.
function isRealDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// "Diisi" = apa-apa nilai bukan string kosong (termasuk array pollution).
function isFilled(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

// Pasangan masa (sama peraturan seperti asal): wajib, HH:MM, tamat >= mula.
function checkTimePair(startRaw, endRaw) {
  const result = {};
  if (startRaw === '') result.start = 'required';
  else if (!TIME_RE.test(startRaw)) result.start = 'invalid';
  if (endRaw === '') result.end = 'required';
  else if (!TIME_RE.test(endRaw)) result.end = 'invalid';
  if (!result.start && !result.end && endRaw < startRaw) result.end = 'order';
  return result;
}

function validateRangeSchedule(body, errors, clean) {
  if (isFilled(body.time_mode) || isFilled(body.sessions)) {
    errors.date_mode = MESSAGES.date_mode.mismatch;
    return;
  }

  // Tarikh Mula (wajib) + Tarikh Tamat (opsyenal, mesti >= Tarikh Mula jika
  // diisi). Perbandingan string "YYYY-MM-DD" selamat kerana zero-padded
  // (sama teknik seperti perbandingan masa "HH:MM" di bawah).
  const dateStartRaw = typeof body.program_date_start === 'string' ? body.program_date_start.trim() : '';
  const dateEndRaw = typeof body.program_date_end === 'string' ? body.program_date_end.trim() : '';

  if (dateStartRaw === '') {
    errors.program_date_start = MESSAGES.program_date_start.required;
  } else if (!isRealDate(dateStartRaw)) {
    errors.program_date_start = MESSAGES.program_date_start.invalid;
  }

  if (dateEndRaw !== '') {
    if (!isRealDate(dateEndRaw)) {
      errors.program_date_end = MESSAGES.program_date_end.invalid;
    } else if (!errors.program_date_start && dateEndRaw < dateStartRaw) {
      errors.program_date_end = MESSAGES.program_date_end.order;
    }
  }

  if (!errors.program_date_start) {
    clean.program_date_start = dateStartRaw;
    if (dateEndRaw !== '' && !errors.program_date_end) {
      clean.program_date_end = dateEndRaw;
    }
  }

  // Masa - dibandingkan sebagai string "HH:MM" (selamat kerana zero-padded 24 jam)
  const startRaw = typeof body.start_time === 'string' ? body.start_time.trim() : '';
  const endRaw = typeof body.end_time === 'string' ? body.end_time.trim() : '';

  if (startRaw === '') {
    errors.start_time = MESSAGES.start_time.required;
  } else if (!TIME_RE.test(startRaw)) {
    errors.start_time = MESSAGES.start_time.invalid;
  }

  if (endRaw === '') {
    errors.end_time = MESSAGES.end_time.required;
  } else if (!TIME_RE.test(endRaw)) {
    errors.end_time = MESSAGES.end_time.invalid;
  }

  if (!errors.start_time && !errors.end_time) {
    if (endRaw < startRaw) {
      errors.end_time = MESSAGES.end_time.order;
    } else {
      clean.start_time = startRaw;
      clean.end_time = endRaw;
    }
  }

  if (!errors.program_date_start && !errors.program_date_end && clean.start_time) {
    clean.schedule = {
      mode: 'range',
      start_date: clean.program_date_start,
      end_date: clean.program_date_end || null,
      start_time: clean.start_time,
      end_time: clean.end_time,
    };
  }
}

function validateSeparateSchedule(body, errors, clean) {
  const msg = MESSAGES.sessions;

  if (isFilled(body.program_date_start) || isFilled(body.program_date_end)) {
    errors.date_mode = MESSAGES.date_mode.mismatch;
    return;
  }

  const timeMode = trimmed(body.time_mode);
  if (timeMode === '') {
    errors.time_mode = MESSAGES.time_mode.required;
    return;
  }
  if (!TIME_MODES.includes(timeMode)) {
    errors.time_mode = MESSAGES.time_mode.invalid;
    return;
  }
  // Masa Berbeza: masa umum (start_time/end_time) milik mod lain - tolak.
  if (timeMode === 'different' && (isFilled(body.start_time) || isFilled(body.end_time))) {
    errors.time_mode = MESSAGES.date_mode.mismatch;
    return;
  }

  const rawSessions = trimmed(body.sessions);
  if (rawSessions === '') {
    errors.sessions = msg.min;
    return;
  }
  let list;
  try {
    list = rawSessions.length <= MAX_SESSIONS_JSON ? JSON.parse(rawSessions) : null;
  } catch {
    list = null;
  }
  if (!Array.isArray(list)) {
    errors.sessions = msg.invalid;
    return;
  }
  if (list.length < MIN_SESSIONS) {
    errors.sessions = msg.min;
    return;
  }
  if (list.length > MAX_SESSIONS) {
    errors.sessions = msg.max;
    return;
  }

  const allowedKeys = timeMode === 'same' ? ['date'] : ['date', 'start_time', 'end_time'];
  const sessions = [];
  for (let i = 0; i < list.length; i += 1) {
    const n = i + 1;
    const item = list[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.sessions = msg.invalid;
      return;
    }
    // Data sesi tambahan yang tidak sepadan dengan mod masa (cth. masa
    // per-tarikh semasa "Masa Sama") ditolak.
    if (Object.keys(item).some((key) => !allowedKeys.includes(key))) {
      errors.sessions = MESSAGES.date_mode.mismatch;
      return;
    }
    const date = trimmed(item.date);
    if (date === '') {
      errors.sessions = msg.dateRequired(n);
      return;
    }
    if (!isRealDate(date)) {
      errors.sessions = msg.dateInvalid(n);
      return;
    }
    const session = { date };
    if (timeMode === 'different') {
      const startRaw = trimmed(item.start_time);
      const endRaw = trimmed(item.end_time);
      const t = checkTimePair(startRaw, endRaw);
      if (t.start === 'required' || t.end === 'required') {
        errors.sessions = msg.timeRequired(n);
        return;
      }
      if (t.start === 'invalid' || t.end === 'invalid') {
        errors.sessions = msg.timeInvalid(n);
        return;
      }
      if (t.end === 'order') {
        errors.sessions = msg.timeOrder(n);
        return;
      }
      session.start_time = startRaw;
      session.end_time = endRaw;
    }
    sessions.push(session);
  }

  if (new Set(sessions.map((s) => s.date)).size !== sessions.length) {
    errors.sessions = msg.duplicate;
    return;
  }

  if (timeMode === 'same') {
    const startRaw = trimmed(body.start_time);
    const endRaw = trimmed(body.end_time);
    const t = checkTimePair(startRaw, endRaw);
    if (t.start) errors.start_time = MESSAGES.start_time[t.start];
    if (t.end) errors.end_time = MESSAGES.end_time[t.end];
    if (t.start || t.end) return;
    sessions.forEach((s) => {
      s.start_time = startRaw;
      s.end_time = endRaw;
    });
  }

  // Susun automatik paling awal -> paling lewat; masa kekal bersama tarikhnya.
  sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  clean.program_date_start = sessions[0].date;
  clean.schedule = { mode: 'separate', time_mode: timeMode, sessions };
}

function validateSchedule(body, errors, clean) {
  const rawMode = body.date_mode;
  const mode = rawMode === undefined ? 'range' : trimmed(rawMode);
  if (!DATE_MODES.includes(mode)) {
    errors.date_mode = MESSAGES.date_mode.invalid;
    return;
  }
  if (mode === 'range') validateRangeSchedule(body, errors, clean);
  else validateSeparateSchedule(body, errors, clean);
}


// ===================== LAIN-LAIN (NYATAKAN) (Pembaharuan 03) =====================
// Medan borang: additional_info = JSON string [{ "title", "content" }] (0-3 set,
// ikut susunan borang). Tiada / kosong / [] -> tiada maklumat tambahan
// (tingkah laku asal). Setiap set: tajuk DAN isi wajib (whitespace sahaja
// ditolak). Tajuk satu baris, tanpa < atau >. Isi kekal baris barunya
// (\r\n dinormalkan ke \n). Escape HTML dibuat oleh Handlebars {{...}}.
function validateAdditionalInfo(body, errors, clean) {
  const msg = MESSAGES.additional_info;
  clean.additional_info = null;

  const raw = body.additional_info;
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return;
  if (typeof raw !== 'string' || raw.length > MAX_ADDITIONAL_INFO_JSON) {
    errors.additional_info = msg.invalid;
    return;
  }

  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    list = null;
  }
  if (!Array.isArray(list)) {
    errors.additional_info = msg.invalid;
    return;
  }
  if (list.length === 0) return;
  if (list.length > MAX_ADDITIONAL_INFO) {
    errors.additional_info = msg.max;
    return;
  }

  const items = [];
  for (let i = 0; i < list.length; i += 1) {
    const n = i + 1;
    const item = list[i];
    if (
      !item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some((key) => key !== 'title' && key !== 'content') ||
      (item.title !== undefined && typeof item.title !== 'string') ||
      (item.content !== undefined && typeof item.content !== 'string')
    ) {
      errors.additional_info = msg.invalid;
      return;
    }
    // Tajuk: satu baris - aksara kawalan/baris baru jadi ruang, ruang dimampatkan.
    const title = (item.title || '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Isi: kekalkan baris baru guru; buang ruang di hujung setiap baris & keseluruhan.
    const content = (item.content || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .join('\n')
      .replace(/^\n+|\n+$/g, '');

    if (title === '') {
      errors.additional_info = msg.titleRequired(n);
      return;
    }
    if (title.length > ADDITIONAL_INFO_TITLE_MAX) {
      errors.additional_info = msg.titleMax(n);
      return;
    }
    if (/[<>]/.test(title)) {
      errors.additional_info = msg.titleHtml(n);
      return;
    }
    if (content.trim() === '') {
      errors.additional_info = msg.contentRequired(n);
      return;
    }
    if (content.length > ADDITIONAL_INFO_CONTENT_MAX) {
      errors.additional_info = msg.contentMax(n);
      return;
    }
    items.push({ title, content });
  }
  clean.additional_info = items;
}

// Pembaharuan 04: Jawatan tandatangan - OPSYENAL. Kosong / whitespace sahaja
// -> null (tiada apa dipapar). Satu baris: aksara kawalan & baris baru jadi
// ruang, ruang berturut dimampatkan, trim hujung. Huruf besar/kecil guru
// dikekalkan. Escape HTML oleh Handlebars {{...}}.
function checkPosition(body, errors, clean, key) {
  const raw = typeof body[key] === 'string' ? body[key] : '';
  const value = raw
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (value.length > LIMITS[key]) {
    errors[key] = MESSAGES[key].maxLength;
    return;
  }
  clean[key] = value === '' ? null : value;
}

function validateFields(body) {
  body = body || {};
  const errors = {};
  const clean = {};

  checkText(body, errors, clean, 'program_name');
  checkEnum(body, errors, clean, 'organizer', ORGANIZER_OPTIONS);
  if (!errors.organizer) {
    // organizer_category = pilihan dropdown (salah satu daripada 4) - untuk
    // tema warna PDF. Untuk 3 anjuran asal, organizer_other DIABAIKAN
    // sepenuhnya walaupun dihantar (tingkah laku asal kekal).
    clean.organizer_category = clean.organizer;
    if (clean.organizer === OTHER_ORGANIZER) {
      checkOrganizerOther(body, errors, clean);
    }
  }
  checkText(body, errors, clean, 'location');
  checkText(body, errors, clean, 'target_group');
  checkOptionalText(body, errors, clean, 'objectives');
  checkOptionalText(body, errors, clean, 'activity_summary');
  checkOptionalText(body, errors, clean, 'strengths');
  checkOptionalText(body, errors, clean, 'weaknesses');
  checkOptionalText(body, errors, clean, 'improvements');
  validateAdditionalInfo(body, errors, clean);
  checkText(body, errors, clean, 'prepared_by');
  checkPosition(body, errors, clean, 'prepared_by_position');
  checkText(body, errors, clean, 'verified_by');
  checkPosition(body, errors, clean, 'verified_by_position');

  validateSchedule(body, errors, clean);

  return { errors, clean };
}

function validateImages(files) {
  if (!files || files.length !== REQUIRED_IMAGES) {
    return MESSAGES.images.count;
  }
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return MESSAGES.images.size;
    }
    const detected = detectImageType(file.path);
    if (!detected || !ALLOWED_IMAGE_MIME.has(detected)) {
      return MESSAGES.images.type;
    }
  }
  return null;
}

module.exports = { validateFields, validateImages };
