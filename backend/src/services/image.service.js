const sharp = require('sharp');

// Long-edge sasaran ~1800px: cukup untuk kualiti cetak A4 pada slot terbesar
// (1 gambar memenuhi keseluruhan kawasan dokumentasi, anggaran ~190mm lebar).
// 1800px pada slot itu bersamaan lebih kurang 240 DPI efektif - lebih daripada
// cukup untuk cetakan pejabat biasa, jauh lebih kecil daripada 12-48MP asal
// gambar telefon (yang boleh melebihi 4000-8000px sisi panjang).
const TARGET_LONG_EDGE = 1800;
const JPEG_QUALITY = 82;

// Proses satu fail gambar (path sementara) -> buffer JPEG. Tidak menulis
// apa-apa ke cakera - hasil hanya wujud dalam memori sepanjang request.
async function processImageToBuffer(filePath) {
  return sharp(filePath)
    .rotate() // auto-putar ikut EXIF orientation, kemudian buang tag EXIF (sudah "dibakar")
    .resize({
      width: TARGET_LONG_EDGE,
      height: TARGET_LONG_EDGE,
      fit: 'inside', // kekalkan aspect ratio, jangan besarkan gambar kecil
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

function bufferToDataUri(buffer) {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function processImageToDataUri(filePath) {
  return bufferToDataUri(await processImageToBuffer(filePath));
}

async function processImages(files) {
  return Promise.all(files.map((file) => processImageToDataUri(file.path)));
}

// Kemas Kini 2: buffer JPEG yang SAMA TEPAT seperti yang dibenamkan dalam PDF
// - disimpan (opr.imageStore) supaya borang Edit boleh guna semula gambar.
async function processImageBuffers(files) {
  return Promise.all(files.map((file) => processImageToBuffer(file.path)));
}

module.exports = { processImages, processImageBuffers, bufferToDataUri, TARGET_LONG_EDGE, JPEG_QUALITY };
