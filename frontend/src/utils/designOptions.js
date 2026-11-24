// Kemas Kini 5/6: pilihan reka bentuk OPR untuk borang (10 design). Warna & jenis corak
// SAMA dengan konfigurasi backend (backend/src/templates/designs.js) - hanya
// untuk kad pratonton ringan (CSS, tiada imej/PDF/Chromium).
// Backend ialah pengesah muktamad; 'random' diselesaikan di backend.

export const RANDOM_DESIGN = 'random';

export const DESIGN_OPTIONS = [
  {
    id: 'original',
    label: 'Original',
    note: 'Reka bentuk asal - warna ikut kategori anjuran',
    // Pratonton menggunakan tema KURIKULUM (biru); PDF sebenar ikut anjuran.
    colors: { primary: '#163E7A', secondary: '#163E7A', ink: '#17181A', light: '#E8EEF6', tab: '#C9CBC7', rule: null },
    pattern: null,
  },
  {
    id: 'corporate',
    label: 'Corporate',
    note: 'Navy, biru kelabu & perak',
    colors: { primary: '#1F3A5F', secondary: '#7288A6', ink: '#26313F', light: '#E7ECF2', tab: '#C3CBD5', rule: '#A7B3C2' },
    pattern: 'repeating-linear-gradient(135deg, #6E829A 0 1px, #1F3A5F 1px 6px)',
  },
  {
    id: 'nature',
    label: 'Nature',
    note: 'Zamrud, sage & hijau lembut',
    colors: { primary: '#0B6B4C', secondary: '#2A9A76', ink: '#1F3A30', light: '#E8F2EC', tab: '#BFD3C5', rule: '#9DBFA8' },
    pattern: 'repeating-linear-gradient(0deg, #3A8669 0 2px, #0B6B4C 2px 6px)',
  },
  {
    id: 'royal',
    label: 'Royal',
    note: 'Plum dengan aksen emas lembut',
    colors: { primary: '#5A2A5C', secondary: '#99729B', ink: '#2B1D2E', light: '#F3EAF2', tab: '#D8C9A0', rule: '#C9A961' },
    pattern: 'repeating-linear-gradient(45deg, #9F7A6D 0 1px, #5A2A5C 1px 2px, #9F7A6D 2px 3px, #5A2A5C 3px 9px)',
  },
  // ===== Kemas Kini 6: 6 design baharu (prototaip KK6) =====
  {
    id: 'ocean',
    label: 'Ocean',
    note: 'Teal laut & biru air',
    colors: { primary: '#086C82', secondary: '#2996AE', ink: '#123C45', light: '#E6F4F6', tab: '#B9DFE4', rule: '#72C3CD' },
    pattern: 'repeating-linear-gradient(0deg, #3D97A8 0 2px, #086C82 2px 5px, #2A8597 5px 6px, #086C82 6px 11px)',
  },
  {
    id: 'burgundy',
    label: 'Burgundy',
    note: 'Merah wain & champagne',
    colors: { primary: '#742D42', secondary: '#B9667E', ink: '#3A1620', light: '#F7EFE6', tab: '#E6D3BC', rule: '#DEBD9A' },
    pattern: 'repeating-linear-gradient(45deg, #9A5A5F 0 4px, #742D42 4px 11px)',
  },
  {
    id: 'forest',
    label: 'Forest',
    note: 'Hijau hutan & olive',
    colors: { primary: '#294C38', secondary: '#5B8B6F', ink: '#17291F', light: '#F0F2E6', tab: '#CDD1AE', rule: '#A7AD79' },
    pattern: 'repeating-linear-gradient(90deg, #58745A 0 1px, #294C38 1px 5px, #58745A 5px 6px, #294C38 6px 14px)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    note: 'Biru malam & biru ais',
    colors: { primary: '#172C50', secondary: '#5B7DB7', ink: '#0F1B30', light: '#EAF3FA', tab: '#C3DBEC', rule: '#82B7D9' },
    pattern: 'repeating-linear-gradient(60deg, #4D7295 0 1px, #172C50 1px 7px, #32507A 7px 8px, #172C50 8px 15px)',
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    note: 'Tanah liat & krim',
    colors: { primary: '#91492F', secondary: '#BB6E52', ink: '#3B2219', light: '#FBF3EA', tab: '#EBCDB1', rule: '#E2B68E' },
    pattern: 'repeating-linear-gradient(135deg, #AE6E50 0 3px, #91492F 3px 5px, #AE6E50 5px 6px, #91492F 6px 11px)',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    note: 'Arang & kelabu teknikal',
    colors: { primary: '#303A44', secondary: '#6B8197', ink: '#1B2128', light: '#EEF1F4', tab: '#CDD6DD', rule: '#AEBCC7' },
    pattern: 'repeating-linear-gradient(90deg, #66717B 0 1px, #303A44 1px 5px, #48525C 5px 6px, #303A44 6px 10px)',
  },
];

export const DESIGN_IDS = DESIGN_OPTIONS.map((d) => d.id);

export function designLabel(id) {
  const found = DESIGN_OPTIONS.find((d) => d.id === id);
  return found ? found.label : 'Original';
}
