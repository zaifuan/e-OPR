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
};

// Anjuran kini dropdown wajib - tepat 3 pilihan sahaja, bukan teks bebas.
const ALLOWED_ORGANIZERS = ['KURIKULUM', 'HAL EHWAL MURID', 'KOKURIKULUM'];

// Dokumentasi Program kini WAJIB tepat 4 gambar (sebelum ini 1-4).
const REQUIRED_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MESSAGES = {
  program_name: { required: 'Sila masukkan nama program.', maxLength: 'Nama program terlalu panjang.' },
  organizer: { required: 'Sila pilih anjuran.', invalid: 'Anjuran tidak sah. Sila pilih daripada pilihan yang disediakan.' },
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
  images: {
    count: `4 gambar dokumentasi diperlukan.`,
    type: 'Format gambar tidak disokong.',
    size: 'Saiz setiap gambar mestilah tidak melebihi 10 MB.',
  },
};

module.exports = { LIMITS, ALLOWED_ORGANIZERS, REQUIRED_IMAGES, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME, MESSAGES };
