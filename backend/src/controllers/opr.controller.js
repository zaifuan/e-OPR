const fsp = require('fs/promises');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const env = require('../config/env');
const { ALLOWED_ORGANIZERS } = require('../constants/opr');
const { validateFields, validateImages } = require('../services/opr.validation');
const { processImages } = require('../services/image.service');
const { renderOprHtml } = require('../templates/opr.template');
const { renderPdfFromHtml } = require('../services/pdf.service');
const { createSemaphore } = require('../utils/semaphore');
const { archiveOprRecord, buildPdfFilename } = require('../services/opr.archive');
const { uploadPdfToDrive, getDriveFileStream } = require('../services/googleDrive.service');
const { findRecords, findAvailableYears, findById } = require('../services/opr.records');

const CURRENT_YEAR = new Date().getFullYear();

// Tahun/Anjuran ialah filter OPSYENAL - string kosong/tiada bermaksud
// "Semua" (valid). Had 4-digit munasabah (Bahagian AC) - bukan sekadar
// integer sebarangan yang boleh mencetuskan carian pelik.
function isValidYearParam(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  const year = Number(raw);
  return Number.isInteger(year) && year >= 2000 && year <= CURRENT_YEAR + 1;
}

// Anjuran filter HANYA menerima 3 nilai tetap sistem (Bahagian AB) - bukan
// arbitrary string daripada client.
function isValidOrganizerParam(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  return ALLOWED_ORGANIZERS.includes(raw);
}

// Had concurrency generation PDF - server dikongsi dengan aplikasi lain, RAM
// terhad (Bahagian 31, Fasa 3). 3 serentak dipilih sebagai titik pertengahan
// munasabah pada skala sekolah tanpa membina queue enterprise.
const pdfSemaphore = createSemaphore(3);
const REQUIRED_PAGE_COUNT = 1;

function tempDirFor(requestId) {
  return path.join(env.TEMP_STORAGE_PATH, requestId);
}

// pdf_filename dijana sistem sendiri (format opr-{tahun}-{uuid}.pdf - lihat
// buildPdfFilename() dalam opr.archive.js), tetapi kekal disanitasi sebagai
// pertahanan berlapis sebelum masuk header HTTP Content-Disposition - tidak
// pernah percaya buta nilai DB terus masuk header tanpa sekatan set aksara.
function safeFilenameForHeader(filename) {
  return String(filename || 'opr.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function cleanupTemp(requestId) {
  if (!requestId) return;
  try {
    await fsp.rm(tempDirFor(requestId), { recursive: true, force: true });
  } catch (err) {
    console.error('[opr] gagal bersihkan folder sementara', requestId, err);
  }
}

// ===================== POST /api/opr (production - Fasa 4) =====================
async function submitOPR(req, res) {
  const startedAt = Date.now();
  const imageCount = (req.files || []).length;

  try {
    const { errors: fieldErrors, clean } = validateFields(req.body);
    const imageError = validateImages(req.files);

    const errors = { ...fieldErrors };
    if (imageError) errors.images = imageError;

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    console.log(`[opr] generation mula - requestId=${req.oprRequestId} imageCount=${imageCount}`);

    await pdfSemaphore.acquire();
    try {
      let imageDataUris;
      try {
        imageDataUris = await processImages(req.files);
      } catch (err) {
        console.error(`[opr] gagal proses gambar - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat memproses gambar. Sila cuba lagi.' });
      }

      let html;
      try {
        html = renderOprHtml(clean, imageDataUris);
      } catch (err) {
        console.error(`[opr] gagal render template - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat menyediakan dokumen OPR. Sila cuba lagi.' });
      }

      let pdfBuffer;
      try {
        pdfBuffer = await renderPdfFromHtml(html);
      } catch (err) {
        console.error(`[opr] gagal jana PDF - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat menjana PDF. Sila cuba lagi.' });
      }

      let pageCount;
      try {
        const doc = await PDFDocument.load(pdfBuffer);
        pageCount = doc.getPageCount();
      } catch (err) {
        console.error(`[opr] gagal sahkan bilangan halaman - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat mengesahkan dokumen PDF. Sila cuba lagi.' });
      }

      if (pageCount !== REQUIRED_PAGE_COUNT) {
        console.error(
          `[opr] generation ditolak - requestId=${req.oprRequestId} pageCount=${pageCount} (melebihi 1 halaman)`
        );
        return res.status(422).json({ message: 'OPR melebihi satu halaman. Sila ringkaskan kandungan.' });
      }

      // ---- Google Drive (Bahagian 5/6/7): PRIMARY STORAGE, bukan backup ----
      // Upload MESTI berjaya SEBELUM rekod dianggap wujud - kegagalan di
      // sini bermakna generation GAGAL sepenuhnya (bukan lagi non-blocking
      // seperti v1 backup).
      const pdfFilename = buildPdfFilename();
      let driveFileId;
      try {
        driveFileId = await uploadPdfToDrive(pdfBuffer, pdfFilename);
      } catch (err) {
        console.error(`[opr] gagal muat naik ke Google Drive - requestId=${req.oprRequestId}`, err.message);
        return res.status(502).json({ error: 'OPR tidak dapat disimpan pada masa ini. Sila cuba lagi.' });
      }

      // ---- Simpan metadata DB (drive_file_id kini wajib disertakan) ----
      // Jika INSERT gagal di sini, opr.archive.js sendiri cuba compensation
      // delete fail Drive orphan yang baru diupload (Bahagian 7/33).
      let record;
      try {
        record = await archiveOprRecord({ clean, pdfFilename, driveFileId });
      } catch (err) {
        console.error(`[opr] gagal arkibkan rekod - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat menyimpan OPR. Sila cuba lagi.' });
      }

      const durationMs = Date.now() - startedAt;
      console.log(
        `[opr] generation selesai - requestId=${req.oprRequestId} id=${record.id} duration=${durationMs}ms ` +
          `pdfSize=${pdfBuffer.length}bytes pageCount=${pageCount}`
      );

      return res.status(201).json({
        success: true,
        record: {
          id: record.id,
          program_name: record.program_name,
          program_date: record.program_date,
          prepared_by: record.prepared_by,
          view_url: `/api/opr/${record.id}/pdf`,
        },
      });
    } finally {
      pdfSemaphore.release();
    }
  } finally {
    await cleanupTemp(req.oprRequestId);
  }
}

// ===================== GET /api/opr/recent =====================
// Endpoint legacy (tiada filter/page eksplisit) - dikekalkan untuk
// keserasian ke belakang dengan hook sedia ada (Dashboard Admin). Kini
// turut sertakan `total` supaya pengiraan hasMore di frontend boleh
// berasaskan total sebenar (lebih teguh berbanding heuristik lama
// "panjang senarai === saiz halaman").
async function getRecent(req, res) {
  const result = await findRecords({ query: '', year: null, organizer: null, page: 1 });
  res.json(result);
}

// ===================== GET /api/opr/search?q=&year=&organizer=&page= =====================
async function search(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!isValidYearParam(req.query.year)) {
    return res.status(400).json({ error: 'Tahun tidak sah.' });
  }
  if (!isValidOrganizerParam(req.query.organizer)) {
    return res.status(400).json({ error: 'Anjuran tidak sah.' });
  }

  const year = req.query.year ? Number(req.query.year) : null;
  const organizer = req.query.organizer || null;
  const pageRaw = Number(req.query.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const result = await findRecords({ query, year, organizer, page });
  res.json(result);
}

// ===================== GET /api/opr/years =====================
// Sumber pilihan dropdown Tahun - daripada rekod SEBENAR dalam DB, bukan
// hardcode (Bahagian B/C).
async function getYears(req, res) {
  const years = await findAvailableYears();
  res.json({ years });
}

// ===================== GET /api/opr/:id =====================
async function getById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Rekod OPR tidak ditemui.' });
  }

  const record = await findById(id);
  if (!record) {
    return res.status(404).json({ error: 'Rekod OPR tidak ditemui.' });
  }

  // Tidak return pdf_path/pdf_filename - butiran filesystem dalaman (Bahagian 22)
  res.json({
    id: record.id,
    program_name: record.program_name,
    program_date: record.program_date,
    organizer: record.organizer,
    prepared_by: record.prepared_by,
    generated_at: record.generated_at,
  });
}

// ===================== GET /api/opr/:id/pdf[?download=1] =====================
async function getPdf(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Rekod OPR tidak ditemui.' });
  }

  const record = await findById(id);
  if (!record) {
    return res.status(404).json({ error: 'Rekod OPR tidak ditemui.' });
  }

  if (!record.drive_file_id) {
    // Rekod tanpa fail Drive (cth. rekod pra-patch primary storage) -
    // integrity gap yang diketahui, bukan crash (Bahagian 44).
    console.error(`[opr] rekod id=${id} tiada drive_file_id`);
    return res.status(404).json({ error: 'Fail PDF tidak ditemui.' });
  }

  let driveStream;
  try {
    driveStream = await getDriveFileStream(record.drive_file_id);
  } catch (err) {
    console.error(`[opr] gagal muat turun daripada Google Drive - id=${id}`, err.message);
    return res.status(502).json({ error: 'PDF tidak dapat dimuatkan buat masa ini. Sila cuba lagi.' });
  }

  res.set('Content-Type', 'application/pdf');
  if (req.query.download === '1') {
    res.set('Content-Disposition', `attachment; filename="${safeFilenameForHeader(record.pdf_filename)}"`);
  } else {
    res.set('Content-Disposition', 'inline');
  }

  driveStream.on('error', (err) => {
    console.error(`[opr] ralat semasa stream PDF daripada Drive - id=${id}`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'PDF tidak dapat dimuatkan buat masa ini. Sila cuba lagi.' });
    } else {
      // Header/sebahagian body sudah dihantar - tidak boleh tukar status,
      // hentikan sahaja response supaya klien tidak menunggu selamanya.
      res.end();
    }
  });

  driveStream.pipe(res);
}

module.exports = { submitOPR, getRecent, search, getYears, getById, getPdf, cleanupTemp, tempDirFor };
