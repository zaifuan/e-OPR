const pool = require('../db/pool');
const { ALLOWED_ORGANIZERS, OTHER_ORGANIZER, LIMITS } = require('../constants/opr');
const { findVersion } = require('./opr.versions');

// Kemas Kini 3: data sumber untuk "Duplicate & Edit".
//
// BACA SAHAJA - tiada penulisan ke rekod sumber. Respons hanya mengandungi
// medan borang yang dibenarkan untuk digunakan semula (whitelist), TANPA:
// token/hash token, drive_file_id, nama fail PDF, rujukan gambar, metadata
// versi/audit, generated_at/edit_expires_at. Tiada kandungan yang direka:
// rekod lama hanya menyalin lajur yang benar-benar wujud dalam PostgreSQL.
//
// Tarikh program sumber TIDAK diisi ke dalam borang (tidak sah untuk program
// baharu) - dipulangkan berasingan sebagai `schedule_reference` untuk rujukan.

const TEXT_KEYS = [
  'program_name',
  'location',
  'target_group',
  'objectives',
  'activity_summary',
  'strengths',
  'weaknesses',
  'improvements',
  'prepared_by',
  'prepared_by_position',
  'verified_by',
  'verified_by_position',
];

// Medan yang TIDAK pernah disimpan bagi rekod sebelum Kemas Kini 2 (label borang).
const LEGACY_MISSING_LABELS = {
  location: 'Tempat',
  target_group: 'Kumpulan Sasaran/Penglibatan',
  objectives: 'Objektif / Matlamat',
  activity_summary: 'Ringkasan Aktiviti',
  strengths: 'Kekuatan',
  weaknesses: 'Kelemahan',
  improvements: 'Penambahbaikan',
  verified_by: 'Disahkan Oleh',
};

const str = (v) => (typeof v === 'string' ? v : '');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const cleanDate = (v) => (typeof v === 'string' && DATE_RE.test(v) ? v : '');
const cleanTime = (v) => (typeof v === 'string' && TIME_RE.test(v) ? v : '');

function cleanAdditionalInfo(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((i) => i && typeof i === 'object')
    .slice(0, 3)
    .map((i) => ({ title: str(i.title), content: str(i.content) }));
}

// Struktur tarikh/masa: jenis tarikh & masa dikekalkan, TARIKH dikosongkan,
// masa disalin (boleh diubah). Rujukan asal dipulangkan berasingan.
function scheduleFromSnapshot(snap) {
  if (snap.date_mode === 'separate') {
    const timeMode = snap.time_mode === 'different' ? 'different' : 'same';
    const sessions = Array.isArray(snap.sessions) ? snap.sessions.slice(0, 5) : [];
    return {
      form: {
        date_mode: 'separate',
        time_mode: timeMode,
        start_time: timeMode === 'same' ? cleanTime(snap.start_time) : '',
        end_time: timeMode === 'same' ? cleanTime(snap.end_time) : '',
        sessions: sessions.map((s) => ({
          start_time: timeMode === 'different' ? cleanTime(s && s.start_time) : '',
          end_time: timeMode === 'different' ? cleanTime(s && s.end_time) : '',
        })),
      },
      reference: {
        mode: 'separate',
        time_mode: timeMode,
        sessions: sessions.map((s) => ({
          date: cleanDate(s && s.date),
          start_time: cleanTime(timeMode === 'different' ? s && s.start_time : snap.start_time),
          end_time: cleanTime(timeMode === 'different' ? s && s.end_time : snap.end_time),
        })),
      },
    };
  }
  return {
    form: { date_mode: 'range', time_mode: 'same', start_time: cleanTime(snap.start_time), end_time: cleanTime(snap.end_time) },
    reference: {
      mode: 'range',
      start_date: cleanDate(snap.program_date_start),
      end_date: cleanDate(snap.program_date_end) || null,
      start_time: cleanTime(snap.start_time),
      end_time: cleanTime(snap.end_time),
    },
  };
}

// Rekod lama: program_schedule (Pembaharuan 02, jika ada) atau program_date sahaja.
function scheduleFromLegacy(record) {
  const sched = record.program_schedule;
  if (sched && sched.mode === 'separate' && Array.isArray(sched.sessions)) {
    const timeMode = sched.time_mode === 'different' ? 'different' : 'same';
    const first = sched.sessions[0] || {};
    return scheduleFromSnapshot({
      date_mode: 'separate',
      time_mode: timeMode,
      start_time: timeMode === 'same' ? first.start_time : '',
      end_time: timeMode === 'same' ? first.end_time : '',
      sessions: sched.sessions,
    });
  }
  if (sched && sched.mode === 'range') {
    return scheduleFromSnapshot({
      date_mode: 'range',
      program_date_start: sched.start_date,
      program_date_end: sched.end_date || '',
      start_time: sched.start_time,
      end_time: sched.end_time,
    });
  }
  // Tiada jadual tersimpan: tarikh utama sahaja (tiada masa direka).
  return scheduleFromSnapshot({ date_mode: 'range', program_date_start: record.program_date_text });
}

function organizerFields(organizer, organizerOther) {
  if (ALLOWED_ORGANIZERS.includes(organizer)) return { organizer, organizer_other: '' };
  if (organizer === OTHER_ORGANIZER) return { organizer, organizer_other: str(organizerOther).slice(0, LIMITS.organizer_other) };
  if (typeof organizer === 'string' && organizer.trim() !== '') {
    // Rekod lama LAIN-LAIN: nama anjuran manual disimpan terus dalam organizer.
    return { organizer: OTHER_ORGANIZER, organizer_other: organizer.slice(0, LIMITS.organizer_other) };
  }
  return { organizer: '', organizer_other: '' }; // rekod sebelum Anjuran wujud
}

async function buildDuplicateSource(id) {
  const { rows } = await pool.query(
    `SELECT id, program_name, to_char(program_date, 'YYYY-MM-DD') AS program_date_text, organizer, prepared_by,
            program_schedule, additional_info, prepared_by_position, verified_by_position, current_version,
            design_id
     FROM opr_records WHERE id = $1`,
    [id]
  );
  const record = rows[0];
  if (!record) return null;

  const version = await findVersion(id, record.current_version);
  const snap = version && version.form_data && typeof version.form_data === 'object' ? version.form_data : null;

  const form = {};
  let schedule;
  let missing = [];

  if (snap) {
    // A. Rekod selepas Kemas Kini 2 - snapshot versi AKTIF terkini.
    for (const key of TEXT_KEYS) form[key] = str(snap[key]);
    Object.assign(form, organizerFields(str(snap.organizer), snap.organizer_other));
    form.additional_info = cleanAdditionalInfo(snap.additional_info);
    schedule = scheduleFromSnapshot(snap);
  } else {
    // B. Rekod lama - HANYA lajur yang benar-benar tersedia; selebihnya kosong.
    for (const key of TEXT_KEYS) form[key] = '';
    form.program_name = str(record.program_name);
    form.prepared_by = str(record.prepared_by);
    form.prepared_by_position = str(record.prepared_by_position);
    form.verified_by_position = str(record.verified_by_position);
    Object.assign(form, organizerFields(record.organizer, null));
    form.additional_info = cleanAdditionalInfo(record.additional_info);
    schedule = scheduleFromLegacy(record);
    missing = Object.values(LEGACY_MISSING_LABELS);
    if (!form.organizer) missing.unshift('Anjuran');
  }
  Object.assign(form, schedule.form);

  return {
    source: { id: record.id, program_name: record.program_name },
    kind: snap ? 'snapshot' : 'legacy',
    // Kemas Kini 5: design versi aktif sumber (rekod sebelum KK5 = 'original')
    // sebagai pilihan AWAL borang Duplicate - bukan Random.
    design_id: record.design_id || 'original',
    form,
    schedule_reference: schedule.reference,
    missing_fields: missing,
  };
}

module.exports = { buildDuplicateSource };
