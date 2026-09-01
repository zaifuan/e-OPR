const { LIMITS, ALLOWED_ORGANIZERS, REQUIRED_IMAGES, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME, MESSAGES } = require('../constants/opr');
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
function checkOptionalText(body, errors, clean, key) {
  const raw = typeof body[key] === 'string' ? body[key].trim() : '';
  if (raw !== '' && raw.length > LIMITS[key]) {
    errors[key] = MESSAGES[key].maxLength;
    return;
  }
  clean[key] = raw;
}

function validateFields(body) {
  body = body || {};
  const errors = {};
  const clean = {};

  checkText(body, errors, clean, 'program_name');
  checkEnum(body, errors, clean, 'organizer', ALLOWED_ORGANIZERS);
  checkText(body, errors, clean, 'location');
  checkText(body, errors, clean, 'target_group');
  checkOptionalText(body, errors, clean, 'objectives');
  checkOptionalText(body, errors, clean, 'activity_summary');
  checkOptionalText(body, errors, clean, 'strengths');
  checkOptionalText(body, errors, clean, 'weaknesses');
  checkOptionalText(body, errors, clean, 'improvements');
  checkText(body, errors, clean, 'prepared_by');
  checkText(body, errors, clean, 'verified_by');

  // Tarikh Mula (wajib) + Tarikh Tamat (opsyenal, mesti >= Tarikh Mula jika
  // diisi). Perbandingan string "YYYY-MM-DD" selamat kerana zero-padded
  // (sama teknik seperti perbandingan masa "HH:MM" di bawah).
  const dateStartRaw = typeof body.program_date_start === 'string' ? body.program_date_start.trim() : '';
  const dateEndRaw = typeof body.program_date_end === 'string' ? body.program_date_end.trim() : '';

  if (dateStartRaw === '') {
    errors.program_date_start = MESSAGES.program_date_start.required;
  } else if (!DATE_RE.test(dateStartRaw) || Number.isNaN(new Date(`${dateStartRaw}T00:00:00`).getTime())) {
    errors.program_date_start = MESSAGES.program_date_start.invalid;
  }

  if (dateEndRaw !== '') {
    if (!DATE_RE.test(dateEndRaw) || Number.isNaN(new Date(`${dateEndRaw}T00:00:00`).getTime())) {
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
