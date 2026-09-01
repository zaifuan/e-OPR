// Tema warna PDF ditentukan secara automatik daripada nilai Anjuran
// (Bahagian D/7 spesifikasi). Struktur/layout template SATU sahaja - hanya
// warna accent yang berubah mengikut jadual ini.
//
// Kemas kini v2: shade dipekatkan (lebih yakin/bold) berdasarkan maklum balas
// - HAL EHWAL MURID kekal selaras dengan warna lencana sekolah sebenar
//   (#109147) sebagai accent.
const THEMES = {
  KURIKULUM: {
    primary: '#163E7A',
    dark: '#0E2A56',
    light: '#E8EEF6',
    accent: '#3B7DDE',
  },
  'HAL EHWAL MURID': {
    primary: '#0F6B37',
    dark: '#0A4B26',
    light: '#E7F3EA',
    accent: '#109147',
  },
  KOKURIKULUM: {
    primary: '#B8590A',
    dark: '#823F08',
    light: '#FBF0E4',
    accent: '#EA9B3D',
  },
};

// Neutral tetap (hitam/kelabu) digunakan merentasi SEMUA tema untuk elemen
// geometri (Bahagian 7: "Gabungkan dengan hitam, putih, light gray, medium gray").
const NEUTRAL = {
  ink: '#17181A',
  gray: '#C9CBC7',
  grayDark: '#8D908B',
};

const DEFAULT_THEME = THEMES.KURIKULUM;

function resolveTheme(organizer) {
  return THEMES[organizer] || DEFAULT_THEME;
}

module.exports = { resolveTheme, THEMES, NEUTRAL };
