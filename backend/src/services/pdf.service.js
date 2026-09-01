const puppeteer = require('puppeteer-core');
const env = require('../config/env');

// Satu instance browser dikongsi merentasi semua request (Bahagian 19 spesifikasi
// Fasa 3) - elak overhead melancar Chromium baharu setiap generation. Jika
// browser crash/disconnect, getBrowser() akan melancar semula secara automatik.
let browserPromise = null;

function launchBrowser() {
  const promise = puppeteer
    .launch({
      executablePath: env.CHROMIUM_PATH,
      headless: true,
      args: [
        // Diperlukan untuk Chromium berjalan dalam container Docker biasa:
        // sandbox dalaman Chromium bergantung pada mekanisme kernel (namespaces/
        // seccomp) yang tidak tersedia tanpa memberi container capability
        // tambahan (cth. CAP_SYS_ADMIN) - yang sebenarnya risiko lebih besar
        // berbanding --no-sandbox di sini. Ini munasabah dalam konteks kita
        // kerana: (1) kita hanya render HTML yang kita bina sendiri (bukan
        // navigasi ke URL luar/tidak dipercayai), (2) semua teks pengguna
        // di-escape HTML oleh Handlebars sebelum dibenamkan ke template.
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // /dev/shm lalai Docker (64MB) selalunya terlalu kecil untuk Chromium
        // render halaman kompleks - elak crash tanpa perlu tambah saiz /dev/shm.
        '--disable-dev-shm-usage',
      ],
    })
    .then((browser) => {
      browser.on('disconnected', () => {
        console.error('[pdf] Chromium terputus - akan relaunch pada permintaan seterusnya');
        browserPromise = null;
      });
      return browser;
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });

  return promise;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = launchBrowser();
    return browserPromise;
  }
  return browser;
}

async function renderPdfFromHtml(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return buffer;
  } finally {
    await page.close().catch(() => {});
  }
}

// Lancar Chromium awal semasa app start supaya request PERTAMA daripada guru
// tidak perlu menunggu masa boot Chromium (~1-2 saat). Jika gagal (cth. path
// Chromium salah), log sahaja - servis lain (health, admin) tetap jalan seperti
// biasa; getBrowser() akan cuba lagi secara automatik apabila diperlukan.
function warmUp() {
  getBrowser().catch((err) => {
    console.error('[pdf] gagal lancar Chromium semasa warm-up:', err.message);
  });
}

async function shutdown() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // sudah tertutup/gagal - tiada tindakan lanjut diperlukan semasa shutdown
  }
}

module.exports = { renderPdfFromHtml, warmUp, shutdown };
