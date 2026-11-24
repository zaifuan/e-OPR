// Kemas Kini 6: konfigurasi 10 reka bentuk (design) OPR.
//  - original/corporate/nature/royal: nilai SAMA TEPAT dengan KK5 (tidak diubah).
//  - ocean/burgundy/forest/midnight/terracotta/graphite: nilai SAMA TEPAT dengan
//    prototaip KK6 yang diluluskan (eOPR-KK6-Prototaip-6Design). Untuk 6 design
//    ini, warna "Secondary" cadangan = accent (garis aksen/corak/tab);
//    palette.secondary (segi tiga g-a) dikira untuk kontras "Report"/"E" >= 3:1.
// SATU template, design = palet warna + corak hiasan (CSS sahaja).
//  - Kategori anjuran (KURIKULUM/HEM/KOKURIKULUM/LAIN-LAIN) KEKAL sebagai data
//    & teks banner. Dalam design 'original', warna masih ikut kategori (theme.js).
//  - Design lain menggantikan PALET warna (bukan geometri) - semua kategori
//    berkongsi palet design tersebut; nama anjuran kekal pada banner.
//  - Corak hanya dalam ZON SELAMAT yang diukur (tiada teks): hujung banner
//    (14mm atas/bawah), bentuk geo-top g-b & g-c, jalur bawah, hujung footer.
//  - palette.secondary: warna segi tiga header (g-a). Ia berada di belakang
//    "Report" (putih) DAN huruf "E" dalam "ONE PAGE" (gelap) - dipilih
//    tona sederhana supaya kontras >=3:1 terhadap KEDUA-DUANYA
//    (kecerahan optimum: (L+0.05)^2 = 1.05 x (L_ink+0.05)).
//  - ID adalah KEKAL (disimpan dalam DB; CHECK constraint migrasi 012).
const DESIGNS = {
  original: { label: 'Original', palette: null, pattern: null },

  corporate: {
    label: 'Corporate',
    palette: {
      primary: '#1F3A5F', // biru navy
      dark: '#152A45',
      light: '#E7ECF2',
      accent: '#A7B3C2', // perak lembut
      secondary: '#7288A6', // biru kelabu - segi tiga header di belakang "Report"/"E"
      ink: '#26313F', // biru kelabu gelap
      gray: '#C3CBD5', // perak
      grayDark: '#5C6878',
    },
    pattern: {
      kind: 'pinstripe', // garis halus serong perak
      line: '#C7D0DB',
      alphaOnPrimary: 0.45,
      alphaOnDark: 0.22,
      accentRule: '#A7B3C2',
    },
  },

  nature: {
    label: 'Nature',
    palette: {
      primary: '#0B6B4C', // hijau zamrud
      dark: '#07503A',
      light: '#E8F2EC',
      accent: '#9DBFA8', // sage
      secondary: '#2A9A76', // zamrud sederhana - segi tiga header
      ink: '#1F3A30', // hijau hutan gelap
      gray: '#BFD3C5', // hijau lembut
      grayDark: '#4E6B5E',
    },
    pattern: {
      kind: 'bands', // jalur tona mendatar sage
      line: '#BEDCC8',
      alphaOnPrimary: 0.22,
      alphaOnDark: 0.14,
      accentRule: '#9DBFA8',
    },
  },

  royal: {
    label: 'Royal',
    palette: {
      primary: '#5A2A5C', // ungu plum
      dark: '#40193F',
      light: '#F3EAF2',
      accent: '#C9A961', // emas lembut
      secondary: '#99729B', // plum lembut - segi tiga header
      ink: '#2B1D2E',
      gray: '#D8C9A0', // emas pucat (tab hiasan - tiada teks)
      grayDark: '#6E5A70',
    },
    pattern: {
      kind: 'doubleline', // garis berkembar emas - HANYA zon tanpa teks
      line: '#D6BA78',
      alphaOnPrimary: 0.55,
      alphaOnDark: 0.35,
      accentRule: '#C9A961',
    },
  },

  // ===== KK6: 6 design baharu =====
  ocean: {
    label: 'Ocean',
    palette: {
      primary: '#086C82', // teal laut (cadangan pengguna)
      dark: '#06505F',
      light: '#E6F4F6', // biru air sangat lembut
      accent: '#72C3CD', // cadangan "Secondary"
      secondary: '#2996AE', // segi tiga header (dikira)
      ink: '#123C45', // teal gelap
      gray: '#B9DFE4',
      grayDark: '#4A6B72',
    },
    pattern: { kind: 'tide', line: '#72C3CD', alphaOnPrimary: 0.45, alphaOnDark: 0.30, accentRule: '#72C3CD' },
  },
  burgundy: {
    label: 'Burgundy',
    palette: {
      primary: '#742D42', // merah wain
      dark: '#561F31',
      light: '#F7EFE6', // champagne pucat
      accent: '#DEBD9A', // champagne/emas lembut
      secondary: '#B9667E',
      ink: '#3A1620', // merah wain gelap
      gray: '#E6D3BC',
      grayDark: '#6E4E57',
    },
    pattern: { kind: 'softdiagonal', line: '#DEBD9A', alphaOnPrimary: 0.28, alphaOnDark: 0.18, accentRule: '#DEBD9A' },
  },
  forest: {
    label: 'Forest',
    palette: {
      primary: '#294C38', // hijau hutan
      dark: '#1D3828',
      light: '#F0F2E6', // olive sangat lembut
      accent: '#A7AD79', // olive
      secondary: '#5B8B6F',
      ink: '#17291F',
      gray: '#CDD1AE',
      grayDark: '#55624F',
    },
    pattern: { kind: 'trunks', line: '#A7AD79', alphaOnPrimary: 0.40, alphaOnDark: 0.30, accentRule: '#A7AD79' },
  },
  midnight: {
    label: 'Midnight',
    palette: {
      primary: '#172C50', // biru malam
      dark: '#10203C',
      light: '#EAF3FA', // biru ais pucat
      accent: '#82B7D9',
      secondary: '#5B7DB7',
      ink: '#0F1B30',
      gray: '#C3DBEC',
      grayDark: '#4E5D73',
    },
    pattern: { kind: 'starline', line: '#82B7D9', alphaOnPrimary: 0.50, alphaOnDark: 0.38, accentRule: '#82B7D9' },
  },
  terracotta: {
    label: 'Terracotta',
    palette: {
      primary: '#91492F', // tanah liat
      dark: '#6E3522',
      light: '#FBF3EA', // krim lembut
      accent: '#E2B68E',
      secondary: '#BB6E52',
      ink: '#3B2219', // coklat tanah gelap
      gray: '#EBCDB1',
      grayDark: '#6E5548',
    },
    pattern: { kind: 'tile', line: '#E2B68E', alphaOnPrimary: 0.32, alphaOnDark: 0.22, accentRule: '#E2B68E' },
  },
  graphite: {
    label: 'Graphite',
    palette: {
      primary: '#303A44', // grafit
      dark: '#232B33',
      light: '#EEF1F4', // kelabu sangat pucat
      accent: '#AEBCC7',
      secondary: '#6B8197',
      ink: '#1B2128', // arang
      gray: '#CDD6DD',
      grayDark: '#5A6570',
    },
    pattern: { kind: 'technical', line: '#AEBCC7', alphaOnPrimary: 0.40, alphaOnDark: 0.30, accentRule: '#AEBCC7' },
  },
};

// ID kekal (susunan paparan). 'random' ialah PILIHAN borang sahaja - bukan design.
const DESIGN_IDS = Object.keys(DESIGNS);

module.exports = { DESIGNS, DESIGN_IDS };
