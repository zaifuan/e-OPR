export const LIMITS = {
  program_name: 150,
  location: 120,
  target_group: 150,
  objectives: 250,
  activity_summary: 300,
  strengths: 180,
  weaknesses: 180,
  improvements: 200,
  prepared_by: 120,
  verified_by: 120,
  prepared_by_position: 80, // Pembaharuan 04: Jawatan (sepadan backend)
  verified_by_position: 80,
  organizer_other: 100, // Nama Anjuran manual (LAIN-LAIN)
};

// Anjuran kini dropdown wajib - tepat 3 pilihan, sepadan dengan backend
// (src/constants/opr.js ALLOWED_ORGANIZERS).
// Pembaharuan 01: pilihan keempat LAIN-LAIN membuka input "Nama Anjuran".
export const OTHER_ORGANIZER = 'LAIN-LAIN';
export const ORGANIZER_OPTIONS = ['KURIKULUM', 'HAL EHWAL MURID', 'KOKURIKULUM', OTHER_ORGANIZER];

// Pembaharuan 02: Tarikh Berasingan - 2 hingga 5 tarikh (sepadan backend).
export const MIN_SESSIONS = 2;
export const MAX_SESSIONS = 5;

// Pembaharuan 03: LAIN-LAIN (NYATAKAN) - sepadan backend (src/constants/opr.js).
export const MAX_ADDITIONAL_INFO = 3;
export const ADDITIONAL_INFO_TITLE_MAX = 40;
export const ADDITIONAL_INFO_CONTENT_MAX = 250;

// Dokumentasi Program kini WAJIB tepat 4 gambar (sebelum ini 1-4).
export const REQUIRED_IMAGES = 4;
export const MAX_IMAGE_MB = 10;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const HARI_MELAYU = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

// Kira hari daripada string "YYYY-MM-DD" (nilai asli <input type="date">).
// Guna constructor Date(tahun, bulan, hari) - ditafsir sebagai waktu TEMPATAN,
// bukan `new Date("YYYY-MM-DD")` yang ditafsir sebagai UTC tengah malam dan
// boleh terbabas sehari bergantung zon waktu pelayar.
export function kiraHari(tarikh) {
  if (!tarikh) return '';
  const parts = tarikh.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '';
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return HARI_MELAYU[date.getDay()];
}

// Pratonton hari untuk borang sahaja (bukan format rasmi PDF - lihat
// formatTarikhInfo di backend/src/utils/malayDate.js untuk versi rasmi).
// Tarikh Tamat kosong/sama dengan Mula -> satu hari sahaja.
export function kiraHariJulat(tarikhMula, tarikhTamat) {
  const hariMula = kiraHari(tarikhMula);
  if (!hariMula) return '';
  if (!tarikhTamat || tarikhTamat === tarikhMula) return hariMula;
  const hariTamat = kiraHari(tarikhTamat);
  if (!hariTamat) return hariMula;
  return `${hariMula} – ${hariTamat}`;
}

const BULAN_MELAYU = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];

// "2026-01-14" -> "14 Januari 2026" - konsisten dengan format dalam PDF (Fasa 3).
export function formatTarikhMelayu(tarikh) {
  if (!tarikh) return '';
  const parts = tarikh.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return tarikh;
  const [year, month, day] = parts;
  return `${day} ${BULAN_MELAYU[month - 1]} ${year}`;
}
