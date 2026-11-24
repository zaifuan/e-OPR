const crypto = require('crypto');
const fsp = require('fs/promises');
const path = require('path');
const env = require('../config/env');

// Kemas Kini 2: storan gambar dokumentasi yang TELAH DIPROSES (JPEG hasil
// sharp - bait yang sama tepat seperti yang dibenamkan dalam PDF) supaya
// borang Edit boleh menggunakan semula gambar tanpa muat naik semula.
//
// - Lokasi: {PDF_STORAGE_PATH}/opr-images/ - volume persistent sedia ada
//   (docker-compose: /data/opr/pdfs:/app/data/pdfs). Tiada volume baharu.
// - Nama fail = SHA-256 kandungan (content-addressed): gambar sama tidak
//   ditulis dua kali, fail sedia ada TIDAK PERNAH ditimpa (flag 'wx').
// - DB hanya menyimpan rujukan {"sha256": "..."} (opr_versions.image_files),
//   bukan data gambar.
// - Nama fail dibina daripada hash yang disahkan regex sahaja - tiada input
//   pengguna terus masuk ke path (tiada path traversal).

const SHA_RE = /^[a-f0-9]{64}$/;

function imagesDir() {
  return path.join(env.PDF_STORAGE_PATH, 'opr-images');
}

function imagePath(sha256) {
  if (!SHA_RE.test(String(sha256))) {
    throw new Error('Rujukan gambar tidak sah.');
  }
  return path.join(imagesDir(), `${sha256}.jpg`);
}

// Simpan senarai buffer; pulangkan { refs: [{sha256}], created: [sha256 baharu] }.
async function saveImages(buffers) {
  await fsp.mkdir(imagesDir(), { recursive: true });
  const refs = [];
  const created = [];
  for (const buffer of buffers) {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const target = imagePath(sha256);
    const tmp = `${target}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      // Tulis ke fail sementara dahulu, kemudian link -> elak fail separuh
      // ditulis kelihatan sah jika proses terhenti di tengah jalan.
      await fsp.writeFile(tmp, buffer, { flag: 'wx' });
      try {
        await fsp.link(tmp, target);
        created.push(sha256);
      } catch (err) {
        if (err.code !== 'EEXIST') throw err; // sudah wujud (kandungan sama) - guna semula
      }
    } finally {
      await fsp.rm(tmp, { force: true });
    }
    refs.push({ sha256 });
  }
  return { refs, created };
}

async function readImage(sha256) {
  return fsp.readFile(imagePath(sha256));
}

// NOTA: fail gambar TIDAK dipadam apabila operasi kemudian gagal. Fail adalah
// content-addressed dan boleh dirujuk serentak oleh permintaan lain yang
// memuat naik gambar sama; memadamnya berisiko memutuskan rujukan sah. Kesan
// kegagalan hanyalah fail kecil yang tidak dirujuk (selamat, tiada data rosak).

function isValidRefList(list, expectedLength) {
  return (
    Array.isArray(list) &&
    list.length === expectedLength &&
    list.every((item) => item && typeof item === 'object' && SHA_RE.test(String(item.sha256)))
  );
}

module.exports = { saveImages, readImage, isValidRefList, imagePath };
