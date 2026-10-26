const HARI_MELAYU = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const BULAN_MELAYU = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];

// Kira hari daripada "YYYY-MM-DD" menggunakan constructor Date(tahun, bulan, hari)
// - ditafsir sebagai waktu TEMPATAN proses Node, BUKAN "new Date(str)" yang
// ditafsir sebagai UTC tengah malam dan boleh terbabas sehari bergantung zon
// waktu container. Pengiraan ini konsisten tidak kira zon waktu sistem kerana
// binaan dan bacaan .getDay() berlaku dalam rangka rujukan tempatan yang sama
// (tiada penukaran UTC<->tempatan berlaku langsung).
function kiraHari(tarikhStr) {
  const [year, month, day] = tarikhStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return HARI_MELAYU[date.getDay()];
}

// "2026-08-27" -> "27 Ogos 2026"
function formatTarikhMelayu(tarikhStr) {
  const [year, month, day] = tarikhStr.split('-').map(Number);
  return `${day} ${BULAN_MELAYU[month - 1]} ${year}`;
}

// "09:00" -> "9:00 pagi". Sempadan waktu ditetapkan mengikut keputusan eksplisit:
// 00:00-11:59 pagi, 12:00-12:59 tengah hari, 13:00-18:59 petang, 19:00-23:59 malam.
function formatMasaMelayu(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  let period;
  if (h < 12) period = 'pagi';
  else if (h < 13) period = 'tengah hari';
  else if (h < 19) period = 'petang';
  else period = 'malam';

  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Pembaharuan 02: format tarikh ringkas PDF. "2026-11-19" -> "19/11/2026"
function formatTarikhRingkas(tarikhStr) {
  const [year, month, day] = tarikhStr.split('-');
  return `${day}/${month}/${year}`;
}

// Senarai tarikh berasingan (sudah tersusun). Bentuk ringkas "19/11, 24/11,
// 30/11/2026" HANYA jika SEMUA tarikh dalam bulan & tahun yang sama; jika
// tidak, tarikh lengkap setiap satu ("30/11/2026, 02/12/2026") - elak salah
// tafsir.
function formatSenaraiTarikh(tarikhList) {
  const bulanTahun = tarikhList[0].slice(0, 7);
  const samaBulanTahun = tarikhList.every((t) => t.slice(0, 7) === bulanTahun);
  if (!samaBulanTahun) {
    return tarikhList.map(formatTarikhRingkas).join(', ');
  }
  const year = tarikhList[0].slice(0, 4);
  return tarikhList
    .map((t, i) => {
      const [, month, day] = t.split('-');
      return i === tarikhList.length - 1 ? `${day}/${month}/${year}` : `${day}/${month}`;
    })
    .join(', ');
}

function bahagianWaktu(timeStr) {
  return formatMasaMelayu(timeStr).split(' ').slice(1).join(' ');
}

// Jadual masa berbeza: jika mula & tamat dalam bahagian waktu yang sama,
// sebut sekali di hujung ("8:00 – 10:00 pagi"); jika berbeza, penuh
// ("9:00 pagi – 12:00 tengah hari").
function formatJulatMasaRingkas(startStr, endStr) {
  const waktu = bahagianWaktu(startStr);
  if (waktu === bahagianWaktu(endStr)) {
    const jamMula = formatMasaMelayu(startStr).split(' ')[0];
    return `${jamMula} – ${formatMasaMelayu(endStr)}`;
  }
  return formatJulatMasaMelayu(startStr, endStr);
}

function formatJulatMasaMelayu(startStr, endStr) {
  return `${formatMasaMelayu(startStr)} – ${formatMasaMelayu(endStr)}`;
}

// Tarikh Tamat kini opsyenal (struktur maklumat baharu). Jika kosong ATAU
// sama dengan Tarikh Mula, papar SATU tarikh sahaja - elak julat berulang
// seperti "26 Ogos 2026 - 26 Ogos 2026". line2 (hari) hanya diisi untuk
// kes julat sebenar; kes satu-hari menggabungkan tarikh+hari dalam line1
// sahaja (sepadan gaya sedia ada "27 Ogos 2026 / Rabu").
//
// Pembaharuan 02: tarikh kini format ringkas DD/MM/YYYY. Nama hari
// dikekalkan; pemisah satu-hari ditukar "/" -> "( )" kerana "/" kini
// sebahagian tarikh ("19/11/2026 (Khamis)", bukan "19/11/2026 / Khamis").
function formatTarikhInfo(startStr, endStr) {
  const startDate = formatTarikhRingkas(startStr);
  const startDay = kiraHari(startStr);
  const isRange = Boolean(endStr) && endStr !== startStr;

  if (!isRange) {
    return { line1: `${startDate} (${startDay})`, line2: null };
  }

  const endDate = formatTarikhRingkas(endStr);
  const endDay = kiraHari(endStr);
  return { line1: `${startDate} – ${endDate}`, line2: `${startDay} – ${endDay}` };
}

module.exports = {
  kiraHari,
  formatTarikhMelayu,
  formatMasaMelayu,
  formatJulatMasaMelayu,
  formatTarikhInfo,
  formatTarikhRingkas,
  formatSenaraiTarikh,
  formatJulatMasaRingkas,
};
