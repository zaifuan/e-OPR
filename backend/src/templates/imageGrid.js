// Dokumentasi Program kini SENTIASA tepat 4 gambar (Bahagian G/H) - tersusun
// menegak di lajur kanan. Setiap frame guna teknik "blurred letterbox": salinan
// gambar yang sama sebagai latar (cover, kabur, digelapkan) supaya gambar
// sebenar (contain, penuh kelihatan tanpa dipotong) sentiasa muat kemas tidak
// kira orientasi (portrait/landscape/square) - Bahagian I spesifikasi.
//
// dataUris sudah selamat (base64, dijana sendiri oleh image.service.js) -
// tiada risiko HTML injection walaupun tanpa auto-escape Handlebars di sini.
function photoFrame(dataUri, index) {
  return (
    `<div class="photo-frame"><div class="photo-frame-inner">` +
    `<img class="photo-bg" src="${dataUri}" alt="" />` +
    `<img class="photo-fg" src="${dataUri}" alt="Dokumentasi Program ${index}" />` +
    `</div></div>`
  );
}

function buildImageGridHtml(dataUris) {
  if (dataUris.length !== 4) {
    // Sepatutnya mustahil dicapai - validation (opr.validation.js) sudah
    // menjamin tepat 4 gambar sebelum sampai ke sini. Kekal sebagai jaminan
    // eksplisit supaya template tidak pernah render struktur separuh/salah.
    throw new Error(`Templat memerlukan tepat 4 gambar, diterima: ${dataUris.length}`);
  }
  return dataUris.map((uri, i) => photoFrame(uri, i + 1)).join('');
}

module.exports = { buildImageGridHtml };
