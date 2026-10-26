const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { buildImageGridHtml } = require('./imageGrid');
const { resolveTheme, NEUTRAL } = require('./theme');
const {
  formatJulatMasaMelayu,
  formatTarikhInfo,
  formatTarikhRingkas,
  formatSenaraiTarikh,
  formatJulatMasaRingkas,
} = require('../utils/malayDate');

const SCHOOL_NAME = 'SABK MAAHAD AL-KHAIR LIL BANAT';
const SCHOOL_CODE = 'AFT6003';
const SLOGAN = 'MEMACU KECEMERLANGAN LUAR BIASA';

const templateSource = fs.readFileSync(path.join(__dirname, 'opr.template.hbs'), 'utf8');
const logoSvg = fs.readFileSync(path.join(__dirname, 'assets', 'logo-sekolah.svg'), 'utf8');
const compiledTemplate = Handlebars.compile(templateSource);

// `clean` - field teks yang sudah disahkan (dari opr.validation.js)
// `imageDataUris` - hasil image.service.js (data URI JPEG, sudah diproses) - sentiasa tepat 4
// Pembaharuan 02: bahagian TARIKH/MASA ikut clean.schedule.
//   range                  -> 2 medan TARIKH + MASA (seperti asal)
//   separate + same        -> 2 medan; TARIKH = senarai tarikh, MASA sekali
//   separate + different   -> jadual kecil Tarikh | Masa (scheduleRows)
function buildScheduleView(clean) {
  const schedule = clean.schedule || {
    mode: 'range',
    start_date: clean.program_date_start,
    end_date: clean.program_date_end || null,
    start_time: clean.start_time,
    end_time: clean.end_time,
  };

  if (schedule.mode === 'separate') {
    const { sessions } = schedule;
    if (schedule.time_mode === 'different') {
      return {
        dateInfo: null,
        timeFormatted: null,
        scheduleRows: sessions.map((s) => ({
          date: formatTarikhRingkas(s.date),
          time: formatJulatMasaRingkas(s.start_time, s.end_time),
        })),
      };
    }
    return {
      dateInfo: { line1: formatSenaraiTarikh(sessions.map((s) => s.date)), line2: null },
      timeFormatted: formatJulatMasaMelayu(sessions[0].start_time, sessions[0].end_time),
      scheduleRows: null,
    };
  }

  return {
    dateInfo: formatTarikhInfo(schedule.start_date, schedule.end_date),
    timeFormatted: formatJulatMasaMelayu(schedule.start_time, schedule.end_time),
    scheduleRows: null,
  };
}

function renderOprHtml(clean, imageDataUris) {
  const scheduleView = buildScheduleView(clean);
  const data = {
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    slogan: SLOGAN,
    logoSvg,
    // Tema ikut pilihan dropdown (organizer_category), bukan teks organizer:
    // LAIN-LAIN tiada dalam THEMES -> DEFAULT_THEME (biru KURIKULUM).
    // organizer di bawah = nama manual bagi LAIN-LAIN (dipapar pada banner).
    theme: resolveTheme(clean.organizer_category || clean.organizer),
    neutral: NEUTRAL,
    programName: clean.program_name,
    organizer: clean.organizer,
    dateInfo: scheduleView.dateInfo,
    timeFormatted: scheduleView.timeFormatted,
    scheduleRows: scheduleView.scheduleRows,
    location: clean.location,
    targetGroup: clean.target_group,
    objectives: clean.objectives,
    activitySummary: clean.activity_summary,
    strengths: clean.strengths,
    weaknesses: clean.weaknesses,
    improvements: clean.improvements,
    additionalInfo: clean.additional_info || [], // Pembaharuan 03
    preparedBy: clean.prepared_by,
    verifiedBy: clean.verified_by,
    preparedByPosition: clean.prepared_by_position || null, // Pembaharuan 04
    verifiedByPosition: clean.verified_by_position || null,
    imageGridHtml: buildImageGridHtml(imageDataUris),
  };

  return compiledTemplate(data);
}

module.exports = { renderOprHtml };
