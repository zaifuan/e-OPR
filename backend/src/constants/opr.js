// Had panjang field (Bahagian O - struktur maklumat baharu)
const LIMITS = {
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
  // Pembaharuan 04: Jawatan (opsyenal) di bawah nama tandatangan - had
  // disahkan melalui ujian kapasiti blok tandatangan sebenar (laporan P04).
  prepared_by_position: 80,
  verified_by_position: 80,
  organizer_other: 100, // Nama Anjuran manual (pilihan LAIN-LAIN)
};

// Anjuran kini dropdown wajib - tepat 3 pilihan sahaja, bukan teks bebas.
const ALLOWED_ORGANIZERS = ['KURIKULUM', 'HAL EHWAL MURID', 'KOKURIKULUM'];

// Pembaharuan 01: pilihan keempat LAIN-LAIN. Ia BUKAN nilai yang disimpan -
// apabila dipilih, nama anjuran manual (organizer_other) yang telah disahkan
// menjadi nilai organizer sebenar dalam DB/PDF. ALLOWED_ORGANIZERS kekal 3
// kategori tetap (rujukan tema warna & penapis Rekod OPR).
const OTHER_ORGANIZER = 'LAIN-LAIN';
const ORGANIZER_OPTIONS = [...ALLOWED_ORGANIZERS, OTHER_ORGANIZER];

// Pembaharuan 02: jenis tarikh & masa.
const DATE_MODES = ['range', 'separate']; // Tarikh Berturut-turut | Tarikh Berasingan
const TIME_MODES = ['same', 'different']; // Masa Sama | Masa Berbeza (mod berasingan sahaja)
const MIN_SESSIONS = 2;
const MAX_SESSIONS = 5;
const MAX_SESSIONS_JSON = 2000; // had panjang rentetan JSON sessions (5 sesi ~ 300 aksara)

// Pembaharuan 03: LAIN-LAIN (NYATAKAN) - maklumat tambahan dinamik (opsyenal).
// Had ditentukan melalui ujian kapasiti template sebenar (lihat laporan P03):
//   - tajuk 40 aksara  -> sentiasa satu baris label pada lebar lajur maklumat
//   - isi 250 aksara   -> sama seperti Objektif / Matlamat (seksyen laporan terpanjang kedua)
//   - maksimum 3 set   -> 3 set penuh masih muat 1 halaman bersama kandungan laporan biasa
// Kandungan berlebihan tetap dikawal oleh semakan satu halaman (422).
const MAX_ADDITIONAL_INFO = 3;
const ADDITIONAL_INFO_TITLE_MAX = 40;
const ADDITIONAL_INFO_CONTENT_MAX = 250;
const MAX_ADDITIONAL_INFO_JSON = 5000; // had rentetan JSON (3 x (40 + 250) aksara + struktur)

// Dokumentasi Program kini WAJIB tepat 4 gambar (sebelum ini 1-4).
const REQUIRED_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MESSAGES = {
  program_name: { required: 'Sila masukkan nama program.', maxLength: 'Nama program terlalu panjang.' },
  organizer: { required: 'Sila pilih anjuran.', invalid: 'Anjuran tidak sah. Sila pilih daripada pilihan yang disediakan.' },
  organizer_other: {
    required: 'Sila masukkan nama anjuran.',
    maxLength: 'Nama anjuran tidak boleh melebihi 100 aksara.',
  },
  program_date_start: { required: 'Sila pilih tarikh mula.', invalid: 'Tarikh mula tidak sah.' },
  program_date_end: {
    invalid: 'Tarikh tamat tidak sah.',
    order: 'Tarikh Tamat tidak boleh lebih awal daripada Tarikh Mula.',
  },
  start_time: { required: 'Sila masukkan masa mula.', invalid: 'Masa mula tidak sah.' },
  end_time: {
    required: 'Sila masukkan masa tamat.',
    invalid: 'Masa tamat tidak sah.',
    order: 'Masa tamat mesti selepas atau sama dengan masa mula.',
  },
  location: { required: 'Sila masukkan tempat program.', maxLength: 'Tempat terlalu panjang.' },
  target_group: { required: 'Sila masukkan kumpulan sasaran.', maxLength: 'Kumpulan sasaran tidak boleh melebihi 150 aksara.' },
  objectives: { required: 'Objektif / Matlamat diperlukan.', maxLength: 'Objektif / Matlamat tidak boleh melebihi 250 aksara.' },
  activity_summary: { required: 'Ringkasan Aktiviti diperlukan.', maxLength: 'Ringkasan Aktiviti tidak boleh melebihi 300 aksara.' },
  strengths: { required: 'Kekuatan diperlukan.', maxLength: 'Kekuatan tidak boleh melebihi 180 aksara.' },
  weaknesses: { required: 'Kelemahan diperlukan.', maxLength: 'Kelemahan tidak boleh melebihi 180 aksara.' },
  improvements: { required: 'Penambahbaikan diperlukan.', maxLength: 'Penambahbaikan tidak boleh melebihi 200 aksara.' },
  prepared_by: { required: 'Sila masukkan nama disediakan oleh.', maxLength: 'Nama disediakan oleh terlalu panjang.' },
  verified_by: { required: 'Sila masukkan nama disahkan oleh.', maxLength: 'Nama disahkan oleh terlalu panjang.' },
  prepared_by_position: { maxLength: 'Jawatan (Disediakan Oleh) tidak boleh melebihi 80 aksara.' },
  verified_by_position: { maxLength: 'Jawatan (Disahkan Oleh) tidak boleh melebihi 80 aksara.' },
  date_mode: {
    invalid: 'Jenis tarikh tidak sah. Sila pilih Tarikh Berturut-turut atau Tarikh Berasingan.',
    mismatch: 'Maklumat tarikh tidak sepadan dengan jenis tarikh yang dipilih. Sila semak semula borang.',
  },
  time_mode: {
    required: 'Sila pilih jenis masa.',
    invalid: 'Jenis masa tidak sah. Sila pilih Masa Sama atau Masa Berbeza.',
  },
  sessions: {
    min: 'Sila masukkan sekurang-kurangnya 2 tarikh.',
    max: 'Maksimum 5 tarikh sahaja dibenarkan.',
    invalid: 'Maklumat tarikh tidak sah. Sila semak semula borang.',
    duplicate: 'Tarikh tidak boleh berulang. Setiap tarikh mesti berbeza.',
    dateRequired: (n) => `Sila pilih Tarikh ${n}.`,
    dateInvalid: (n) => `Tarikh ${n} tidak sah.`,
    timeRequired: (n) => `Sila masukkan masa mula dan masa tamat bagi Tarikh ${n}.`,
    timeInvalid: (n) => `Masa bagi Tarikh ${n} tidak sah.`,
    timeOrder: (n) => `Masa tamat bagi Tarikh ${n} mesti selepas atau sama dengan masa mula.`,
  },
  additional_info: {
    invalid: 'Maklumat tambahan tidak sah. Sila semak semula borang.',
    max: 'Maksimum 3 maklumat tambahan sahaja dibenarkan.',
    titleRequired: (n) => `Sila masukkan Tajuk Maklumat bagi Maklumat ${n}.`,
    titleMax: (n) => `Tajuk Maklumat bagi Maklumat ${n} tidak boleh melebihi 40 aksara.`,
    titleHtml: (n) => `Tajuk Maklumat bagi Maklumat ${n} tidak boleh mengandungi aksara < atau >.`,
    contentRequired: (n) => `Sila masukkan Isi Kandungan bagi Maklumat ${n}.`,
    contentMax: (n) => `Isi Kandungan bagi Maklumat ${n} tidak boleh melebihi 250 aksara.`,
  },
  images: {
    count: `4 gambar dokumentasi diperlukan.`,
    type: 'Format gambar tidak disokong.',
    size: 'Saiz setiap gambar mestilah tidak melebihi 10 MB.',
  },
};

module.exports = {
  LIMITS,
  ALLOWED_ORGANIZERS,
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
};
