const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { buildImageGridHtml } = require('./imageGrid');
const { resolveTheme, NEUTRAL } = require('./theme');
const { formatJulatMasaMelayu, formatTarikhInfo } = require('../utils/malayDate');

const SCHOOL_NAME = 'SABK MAAHAD AL-KHAIR LIL BANAT';
const SCHOOL_CODE = 'AFT6003';
const SLOGAN = 'MEMACU KECEMERLANGAN LUAR BIASA';

const templateSource = fs.readFileSync(path.join(__dirname, 'opr.template.hbs'), 'utf8');
const logoSvg = fs.readFileSync(path.join(__dirname, 'assets', 'logo-sekolah.svg'), 'utf8');
const compiledTemplate = Handlebars.compile(templateSource);

// `clean` - field teks yang sudah disahkan (dari opr.validation.js)
// `imageDataUris` - hasil image.service.js (data URI JPEG, sudah diproses) - sentiasa tepat 4
function renderOprHtml(clean, imageDataUris) {
  const data = {
    schoolName: SCHOOL_NAME,
    schoolCode: SCHOOL_CODE,
    slogan: SLOGAN,
    logoSvg,
    theme: resolveTheme(clean.organizer),
    neutral: NEUTRAL,
    programName: clean.program_name,
    organizer: clean.organizer,
    dateInfo: formatTarikhInfo(clean.program_date_start, clean.program_date_end),
    timeFormatted: formatJulatMasaMelayu(clean.start_time, clean.end_time),
    location: clean.location,
    targetGroup: clean.target_group,
    objectives: clean.objectives,
    activitySummary: clean.activity_summary,
    strengths: clean.strengths,
    weaknesses: clean.weaknesses,
    improvements: clean.improvements,
    preparedBy: clean.prepared_by,
    verifiedBy: clean.verified_by,
    imageGridHtml: buildImageGridHtml(imageDataUris),
  };

  return compiledTemplate(data);
}

module.exports = { renderOprHtml };
