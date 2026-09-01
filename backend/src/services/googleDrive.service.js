const { Readable } = require('stream');

// Google Drive kini PRIMARY STORAGE untuk PDF OPR (bukan backup optional
// v1 lagi). 4 pembolehubah ini kini secara FUNGSIONAL diperlukan untuk
// generation/view/download - tetapi aplikasi tetap boleh START tanpanya
// (Bahagian 27) supaya admin boleh diagnose; generation/view/download akan
// gagal dengan mesej terkawal jika config tiada, bukan crash startup.
const REQUIRED_ENV_VARS = [
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_DRIVE_REFRESH_TOKEN',
  'GOOGLE_DRIVE_FOLDER_ID',
];

// Had munasabah supaya permintaan tidak tergantung tanpa had (Bahagian 22).
// Muat naik/turun PDF OPR (beberapa ratus KB - beberapa MB) sepatutnya
// selesai jauh lebih pantas daripada ini dalam keadaan normal; nilai ini
// memberi margin munasabah untuk rangkaian perlahan tanpa membiarkan
// request tergantung lama. Tiada retry - satu cubaan sahaja.
//
// PENTING (pembetulan v1.2): nilai ini dihantar sebagai `timeout` kepada
// googleapis/gaxios SECARA LANGSUNG (option rasmi `GaxiosOptions.timeout`),
// BUKAN Promise.race manual. Disahkan daripada kod sumber gaxios sebenar
// yang dipasang (node_modules/gaxios build/cjs/src/gaxios.js,
// #appendTimeoutToSignal) bahawa `timeout` menghasilkan AbortSignal.timeout()
// sebenar yang dihantar terus ke fetch() asli - ini GENUINE abort HTTP
// request (bukan sekadar "berhenti tunggu" di peringkat Promise seperti
// Promise.race, yang meninggalkan request Google tetap berjalan di
// belakang tabir walaupun kita sudah anggap ia gagal).
const UPLOAD_TIMEOUT_MS = 15000;
const DOWNLOAD_TIMEOUT_MS = 20000;
const DELETE_TIMEOUT_MS = 15000;

function isConfigured() {
  return REQUIRED_ENV_VARS.every((key) => Boolean(process.env[key]));
}

let cachedDriveClient = null;

// require('googleapis') diletak DALAM fungsi (bukan top-level) - lapisan
// pertahanan supaya modul ini selamat dimuatkan (server.js memerlukannya
// untuk logStartupStatus()) walau apa jua keadaan, tanpa risiko menjejaskan
// startup (Bahagian 27).
function getDriveClient() {
  if (cachedDriveClient) return cachedDriveClient;

  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET
  );
  // Refresh token sahaja diperlukan di sini - library googleapis
  // mengendalikan pemerolehan/refresh access token secara automatik
  // (Bahagian 15) - tidak pernah disimpan/log secara manual.
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });

  cachedDriveClient = google.drive({ version: 'v3', auth: oauth2Client });
  return cachedDriveClient;
}

// Mesej ralat SELAMAT untuk log sahaja (Bahagian 25) - tidak sekali-kali
// stringify objek ralat penuh (boleh membawa Authorization header/token),
// hanya kod status + mesej ringkas daripada Google API jika ada. `code` di
// sini turut merangkumi nama DOMException (cth. "TimeoutError"/"AbortError")
// apabila timeout native di atas tercetus - selamat dipaparkan, bukan secret.
function safeErrorMessage(err) {
  const status = err?.code || err?.response?.status;
  const apiMessage = err?.errors?.[0]?.message || err?.response?.data?.error?.message;
  const message = apiMessage || err?.message || 'ralat tidak diketahui';
  return status ? `status=${status} message=${message}` : `message=${message}`;
}

// Ralat khas supaya pemanggil boleh bezakan "Drive tidak configured"
// (semakan env, tiada percubaan rangkaian) berbanding kegagalan
// upload/muat-turun/padam sebenar, untuk HTTP status/mesej yang sesuai.
class DriveNotConfiguredError extends Error {
  constructor() {
    super('Google Drive belum dikonfigurasikan.');
    this.name = 'DriveNotConfiguredError';
  }
}

// Dipanggil sekali semasa startup server (Bahagian 27) - semakan env var
// semata-mata, TIADA panggilan rangkaian, jadi tidak melambatkan/menyekat
// startup walau apa keadaan Google Drive sekalipun.
function logStartupStatus() {
  if (isConfigured()) {
    console.log('[Google Drive] Primary storage enabled');
  } else {
    console.log('[Google Drive] Primary storage unavailable: configuration incomplete');
  }
}

// Muat naik PDF final ke Drive - Drive kini PRIMARY STORAGE, jadi fungsi
// ini THROW jika gagal (BERBEZA daripada v1 backup yang "swallow" ralat)
// supaya pemanggil (controller) tahu generation MESTI dianggap gagal
// (Bahagian 5/6). Cubaan SATU KALI sahaja - tiada retry loop.
//
// Timeout: option `timeout` dihantar terus kepada gaxios (lihat nota
// UPLOAD_TIMEOUT_MS di atas) - apabila tercetus, fetch() dalaman gaxios
// BENAR-BENAR di-abort (bukan sekadar promise choose to stop waiting),
// jadi request HTTP ke Google turut diberhentikan di peringkat rangkaian.
// Ini mengelakkan senario orphan Drive file (upload "timeout" pada kita
// tetapi sebenarnya Google masih proses & create fail beberapa saat
// kemudian tanpa DB record) - keperluan kritikal untuk architecture
// Primary Storage.
async function uploadPdfToDrive(pdfBuffer, filename) {
  if (!isConfigured()) {
    throw new DriveNotConfiguredError();
  }

  const drive = getDriveClient();
  try {
    const response = await drive.files.create(
      {
        requestBody: {
          name: filename, // nama SAMA seperti convention sedia ada (Bahagian 18) - opr-{tahun}-{uuid}.pdf
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: 'application/pdf',
          // PENTING: Readable.from(pdfBuffer) SALAH - Buffer boleh diulang
          // (iterable) mengikut byte individu, menyebabkan crash
          // keseluruhan proses (bug v1 yang telah ditemui & dibetulkan).
          // Membungkus dalam array [] menjadikan buffer itu SENDIRI
          // sebagai satu chunk tunggal, seperti yang dimaksudkan.
          body: Readable.from([pdfBuffer]),
        },
        fields: 'id',
      },
      { timeout: UPLOAD_TIMEOUT_MS }
    );
    console.log(`[Google Drive] Upload berjaya - ${filename}`);
    return response.data.id;
  } catch (err) {
    console.error(`[Google Drive] Upload failed: ${safeErrorMessage(err)}`);
    throw err;
  }
}

// Dapatkan stream Drive untuk view/download - backend bertindak sebagai
// proksi (Bahagian 2/13/14), frontend tidak pernah nampak URL/credential
// Drive terus. Pemanggil bertanggungjawab .pipe() stream ini ke res Express
// dan handle event 'error' padanya.
//
// PENTING: timeout native (lihat nota di atas) hanya melindungi fasa
// PERMULAAN request (headers/respons awal Google API). Selepas stream data
// PDF mula mengalir, timeout ini tidak lagi terpakai kepada bacaan
// berterusan setiap byte - pemanggil (getPdf() dalam controller) yang
// mengendalikan event 'error' pada stream itu sendiri untuk kegagalan
// semasa penghantaran data berlaku.
async function getDriveFileStream(fileId) {
  if (!isConfigured()) {
    throw new DriveNotConfiguredError();
  }

  const drive = getDriveClient();
  try {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream', timeout: DOWNLOAD_TIMEOUT_MS }
    );
    return response.data; // Node readable stream
  } catch (err) {
    console.error(`[Google Drive] Download failed: ${safeErrorMessage(err)}`);
    throw err;
  }
}

// Padam fail Drive - digunakan untuk Admin delete DAN compensation cleanup
// (jika DB insert gagal selepas upload berjaya). 404 (fail sudah tiada)
// dianggap KEJAYAAN - idempotent, matlamat akhir "fail tiada di Drive"
// sudah tercapai tidak kira sebab (Bahagian 16/24).
async function deleteDriveFile(fileId) {
  if (!isConfigured()) {
    return { success: false, reason: 'not_configured' };
  }

  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId }, { timeout: DELETE_TIMEOUT_MS });
    console.log('[Google Drive] Delete berjaya');
    return { success: true };
  } catch (err) {
    const status = err?.code || err?.response?.status;
    if (status === 404) {
      console.log('[Google Drive] Delete: fail sudah tiada - dianggap berjaya');
      return { success: true, alreadyMissing: true };
    }
    console.error(`[Google Drive] Delete failed: ${safeErrorMessage(err)}`);
    return { success: false, status };
  }
}

module.exports = {
  isConfigured,
  logStartupStatus,
  uploadPdfToDrive,
  getDriveFileStream,
  deleteDriveFile,
  DriveNotConfiguredError,
};
