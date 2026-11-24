const fsp = require('fs/promises');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const env = require('../config/env');
const { ORGANIZER_OPTIONS, REQUIRED_IMAGES: REQUIRED_IMAGES_COUNT, MESSAGES: OPR_MESSAGES } = require('../constants/opr');
const MESSAGES_IMAGES_COUNT = OPR_MESSAGES.images.count;
const {
  validateFields,
  validateImages,
  validateImageFiles,
  parseImageSlots,
  buildFormSnapshot,
} = require('../services/opr.validation');
const { processImageBuffers, bufferToDataUri } = require('../services/image.service');
const { renderOprHtml } = require('../templates/opr.template');
const { renderPdfFromHtml } = require('../services/pdf.service');
const { createSemaphore } = require('../utils/semaphore');
const {
  archiveOprRecord,
  buildPdfFilename,
  DuplicateTicketUsedError,
  DuplicateSourceMissingError,
} = require('../services/opr.archive');
const { uploadPdfToDrive, getDriveFileStream, deleteDriveFile } = require('../services/googleDrive.service');
const { findRecords, findAvailableYears, findById, SORT_ORDERS } = require('../services/opr.records');
const { saveImages, readImage, isValidRefList } = require('../services/opr.imageStore');
const { generateEditToken, resolveEditor, readTokenFromRequest, getSessionAdmin } = require('../services/opr.editAuth');
const { findEditControl, findVersion, listVersions, commitEditedVersion } = require('../services/opr.versions');
const { buildDuplicateSource } = require('../services/opr.duplicate');
const { parseDesignChoice, resolveDesignForCreate, resolveDesignForEdit } = require('../services/opr.design');
const { issueDuplicateTicket, inspectDuplicateTicket } = require('../services/opr.duplicateTicket');
const pool = require('../db/pool');

const CURRENT_YEAR = new Date().getFullYear();

// Tahun/Anjuran ialah filter OPSYENAL - string kosong/tiada bermaksud
// "Semua" (valid). Had 4-digit munasabah (Bahagian AC) - bukan sekadar
// integer sebarangan yang boleh mencetuskan carian pelik.
function isValidYearParam(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  const year = Number(raw);
  return Number.isInteger(year) && year >= 2000 && year <= CURRENT_YEAR + 1;
}

// Anjuran filter HANYA menerima nilai tetap sistem (Bahagian AB) - bukan
// arbitrary string daripada client. Pembaharuan 01: termasuk LAIN-LAIN
// (merangkumi semua rekod anjuran manual - lihat opr.records.js).
function isValidOrganizerParam(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  return ORGANIZER_OPTIONS.includes(raw);
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

// ===================== Kemas Kini 3: semakan tiket Duplicate =====================
const DUPLICATE_ERRORS = {
  duplicate_ticket_expired: {
    code: 'duplicate_ticket_expired',
    error:
      'Pengesahan sumber Duplicate telah tamat tempoh. Tiada OPR dijana. Sila tekan Jana OPR Baharu sekali lagi.',
  },
  duplicate_ticket_invalid: {
    code: 'duplicate_ticket_invalid',
    error: 'Pengesahan sumber Duplicate tidak sah. Tiada OPR dijana. Sila tekan Jana OPR Baharu sekali lagi.',
  },
  duplicate_source_missing: {
    code: 'duplicate_source_missing',
    error: 'Rekod sumber Duplicate tidak lagi wujud (mungkin telah dipadam). Tiada OPR dijana.',
  },
};

async function ticketUsedBody(nonce) {
  const { rows } = await pool.query('SELECT id FROM opr_records WHERE duplicate_ticket_nonce = $1', [nonce]);
  return {
    code: 'duplicate_ticket_used',
    existing_id: rows[0] ? rows[0].id : null,
    error: 'OPR daripada borang Duplicate ini telah pun dijana. Tiada OPR baharu dijana.',
  };
}

// Pulangkan { ok: true, ticket } atau { ok: false, body } (409).
async function precheckDuplicateTicket(raw) {
  const inspected = inspectDuplicateTicket(raw);
  if (!inspected.ok) {
    return { ok: false, body: DUPLICATE_ERRORS[`duplicate_ticket_${inspected.reason}`] };
  }
  const { sourceId, nonce } = inspected.ticket;
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM opr_records WHERE id = $1) AS source_exists,
            EXISTS (SELECT 1 FROM opr_records WHERE duplicate_ticket_nonce = $2) AS used`,
    [sourceId, nonce]
  );
  if (rows[0].used) return { ok: false, body: await ticketUsedBody(nonce) };
  if (!rows[0].source_exists) return { ok: false, body: DUPLICATE_ERRORS.duplicate_source_missing };
  return { ok: true, ticket: inspected.ticket };
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
    // Kemas Kini 5: pilihan design (random/4 ID) - peraturan bersama opr.design.js
    const designChoice = parseDesignChoice(req.body.design_choice, { allowRandom: true });
    if (!designChoice.ok) errors.design = designChoice.error;

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    // Kemas Kini 3 (pembetulan akhir): mod Duplicate = medan duplicate_ticket
    // DIHANTAR. Disemak SEBELUM penjanaan PDF - tiket bermasalah ditolak 409
    // (boleh dipulihkan) tanpa sebarang rekod/PDF dicipta. Tanpa medan ini,
    // aliran CREATE biasa berjalan seperti asal.
    let duplicateTicket = null;
    if (req.body.duplicate_ticket !== undefined) {
      const pre = await precheckDuplicateTicket(req.body.duplicate_ticket);
      if (!pre.ok) {
        console.log(`[opr] Duplicate ditolak sebelum penjanaan - requestId=${req.oprRequestId} kod=${pre.body.code}`);
        return res.status(409).json(pre.body);
      }
      duplicateTicket = pre.ticket;
    }

    // Kemas Kini 5: Random diselesaikan SEKALI di sini (backend) - design
    // SEBENAR digunakan untuk PDF dan disimpan; 'random' tidak pernah disimpan.
    const designId = resolveDesignForCreate(designChoice.choice);

    console.log(`[opr] generation mula - requestId=${req.oprRequestId} imageCount=${imageCount} design=${designId}`);

    await pdfSemaphore.acquire();
    try {
      let imageDataUris;
      let imageBuffers;
      try {
        // Kemas Kini 2: buffer disimpan untuk Edit; data URI dibina daripada
        // buffer yang SAMA (hasil identik dengan processImages asal).
        imageBuffers = await processImageBuffers(req.files);
        imageDataUris = imageBuffers.map(bufferToDataUri);
      } catch (err) {
        console.error(`[opr] gagal proses gambar - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat memproses gambar. Sila cuba lagi.' });
      }

      let html;
      try {
        html = renderOprHtml(clean, imageDataUris, designId);
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
        // Pembaharuan 03: mesej lebih jelas. PDF tidak dimuat naik & rekod tidak
        // disimpan (return sebelum Drive/DB); folder gambar sementara dibersihkan
        // oleh finally di bawah.
        return res.status(422).json({
          message:
            'Maklumat OPR terlalu panjang untuk dimuatkan dalam satu halaman A4. ' +
            'Sila ringkaskan kandungan atau kurangkan maklumat tambahan.',
        });
      }

      // ---- Kemas Kini 2: simpan gambar diproses untuk kegunaan semula Edit ----
      // Tidak menyekat penjanaan: jika storan gambar gagal, OPR tetap dijana
      // & disimpan seperti biasa; borang Edit kemudian meminta 4 gambar baharu.
      let imageRefs = null;
      try {
        imageRefs = (await saveImages(imageBuffers)).refs;
      } catch (err) {
        console.error(`[opr] gagal simpan gambar untuk Edit - requestId=${req.oprRequestId}`, err.message);
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
      // Kemas Kini 2: token suntingan rahsia - hanya HASH disimpan; token asal
      // dipulangkan SEKALI dalam respons ini kepada pelayar guru.
      const editToken = generateEditToken();
      let record;
      try {
        record = await archiveOprRecord({
          clean,
          pdfFilename,
          driveFileId,
          formData: buildFormSnapshot(req.body),
          imageRefs,
          editTokenHash: editToken.hash,
          // Kemas Kini 3: jejak sumber HANYA daripada tiket bertandatangan yang
          // telah disahkan di atas. Medan duplicated_from_id daripada klien
          // SENGAJA diabaikan.
          duplicateTicket,
          designId,
        });
      } catch (err) {
        // Semakan muktamad dalam transaksi (permintaan serentak / sumber
        // dipadam semasa penjanaan) - tiada rekod disimpan, PDF baharu sudah
        // dibuang oleh compensation dalam opr.archive.js.
        if (err instanceof DuplicateTicketUsedError) {
          return res.status(409).json(await ticketUsedBody(duplicateTicket.nonce));
        }
        if (err instanceof DuplicateSourceMissingError) {
          return res.status(409).json(DUPLICATE_ERRORS.duplicate_source_missing);
        }
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
          // Kemas Kini 2 - medan tambahan (klien lama mengabaikannya)
          version: 1,
          design_id: designId,
          edit_token: editToken.token,
          edit_expires_at: record.edit_expires_at,
          server_time: record.server_time,
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
// Kemas Kini 2: maklumat tempoh suntingan hanya untuk sesi Admin (bukan API
// awam) - digunakan untuk status "Boleh Edit"/"Dikunci" di paparan Admin.
function wantsEditInfo(req) {
  return Boolean(req.session && req.session.adminId);
}

async function getRecent(req, res) {
  const result = await findRecords({ query: '', year: null, organizer: null, page: 1, includeEditInfo: wantsEditInfo(req) });
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
  // Kemas Kini 4: susunan ikut tarikh janaan - whitelist sahaja (lalai: terbaharu).
  const sortRaw = req.query.sort;
  if (sortRaw !== undefined && sortRaw !== '' && !Object.prototype.hasOwnProperty.call(SORT_ORDERS, sortRaw)) {
    return res.status(400).json({ error: 'Susunan tidak sah.' });
  }
  const sort = sortRaw || 'newest';

  const year = req.query.year ? Number(req.query.year) : null;
  const organizer = req.query.organizer || null;
  const pageRaw = Number(req.query.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const result = await findRecords({ query, year, organizer, page, includeEditInfo: wantsEditInfo(req), sort });
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
// Sentiasa menghantar VERSI AKTIF (opr_records.drive_file_id) - Kemas Kini 2
// mengemas kini baris ini apabila versi baharu disimpan, jadi /opr/:id/lihat
// (Kemas Kini 1) terus memaparkan PDF terkini tanpa perubahan.
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

  return streamDrivePdf(req, res, { id, driveFileId: record.drive_file_id, filename: record.pdf_filename });
}

// Strim PDF daripada Google Drive ke respons (dikongsi oleh PDF aktif dan PDF
// versi lama). Logik SAMA seperti getPdf Kemas Kini 1 (dipindahkan, tidak diubah).
async function streamDrivePdf(req, res, { id, driveFileId, filename, extraHeaders = null }) {
  let driveStream;
  try {
    driveStream = await getDriveFileStream(driveFileId);
  } catch (err) {
    console.error(`[opr] gagal muat turun daripada Google Drive - id=${id}`, err.message);
    // Kemas Kini 1: fail sudah tiada di Drive (rekod DB masih wujud) ialah
    // "tidak ditemui", bukan kegagalan storan sementara - 404 supaya viewer
    // tidak menawarkan "Cuba Semula" yang pasti gagal. Ralat lain kekal 502.
    const driveStatus = err?.status ?? err?.response?.status;
    if (driveStatus === 404) {
      return res.status(404).json({ error: 'Fail PDF tidak ditemui.' });
    }
    return res.status(502).json({ error: 'PDF tidak dapat dimuatkan buat masa ini. Sila cuba lagi.' });
  }

  res.set('Content-Type', 'application/pdf');
  if (extraHeaders) res.set(extraHeaders);
  if (req.query.download === '1') {
    res.set('Content-Disposition', `attachment; filename="${safeFilenameForHeader(filename)}"`);
  } else {
    res.set('Content-Disposition', 'inline');
  }

  driveStream.on('error', (err) => {
    console.error(`[opr] ralat semasa stream PDF daripada Drive - id=${id}`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'PDF tidak dapat dimuatkan buat masa ini. Sila cuba lagi.' });
    } else {
      // Header/sebahagian body sudah dihantar - tidak boleh tukar status.
      // Kemas Kini 1: destroy() (bukan end()) - sambungan diputuskan secara
      // tidak normal supaya pelayar/viewer TAHU penghantaran gagal, bukannya
      // menerima/menyimpan PDF terpotong seolah-olah lengkap.
      res.destroy();
    }
  });

  // Kemas Kini 1: jika klien menutup sambungan sebelum PDF habis dihantar
  // (cth. viewer ditutup / Cuba Semula / rangkaian telefon terputus), hentikan
  // stream Drive juga - .pipe() sahaja tidak memusnahkan sumber, menyebabkan
  // sambungan ke Google tergantung sehingga habis dibaca.
  res.on('close', () => {
    if (!res.writableFinished && !driveStream.destroyed) {
      driveStream.destroy();
    }
  });

  driveStream.pipe(res);
}

// ============================================================================
// Kemas Kini 2: EDIT OPR DALAM TEMPOH 24 JAM + SEJARAH VERSI
// ============================================================================

const EDIT_MESSAGES = {
  forbidden: 'Anda tiada kebenaran untuk mengedit OPR ini.',
  locked: 'Tempoh suntingan 24 jam telah tamat. OPR ini telah dikunci.',
  legacy: 'OPR ini dikunci dan tidak boleh diedit.',
  conflict: 'OPR ini telah dikemas kini di tempat lain. Sila muat semula borang Edit dan cuba lagi.',
  notFound: 'Rekod OPR tidak ditemui.',
  imagesUnavailable: 'Gambar asal tidak tersedia. Sila muat naik 4 gambar dokumentasi.',
};

function parseOprId(raw) {
  if (!/^[1-9]\d{0,9}$/.test(String(raw))) return null; // digit sahaja (tiada "3.0", "1e3")
  const id = Number(raw);
  return id <= 2147483647 ? id : null;
}

// Semakan akses suntingan (dikongsi GET borang & middleware sebelum upload).
// Pulangkan { ok: true, ctl, editor } atau { ok: false, status, body }.
async function checkEditAccess(req, id) {
  const ctl = id ? await findEditControl(id) : null;
  if (!ctl) return { ok: false, status: 404, body: { error: EDIT_MESSAGES.notFound, code: 'not_found' } };

  const editor = await resolveEditor(req, ctl);
  if (!editor) return { ok: false, status: 403, body: { error: EDIT_MESSAGES.forbidden, code: 'forbidden' } };

  if (!ctl.edit_open) {
    const legacy = ctl.edit_expires_at === null;
    return {
      ok: false,
      status: 403,
      body: { error: legacy ? EDIT_MESSAGES.legacy : EDIT_MESSAGES.locked, code: 'locked' },
    };
  }
  return { ok: true, ctl, editor };
}

// ===================== GET /api/opr/:id/edit =====================
// Data borang versi aktif + gambar (data URI) untuk borang Edit.
async function getEditData(req, res) {
  res.set('Cache-Control', 'no-store');
  const id = parseOprId(req.params.id);
  const access = await checkEditAccess(req, id);
  if (!access.ok) return res.status(access.status).json(access.body);
  const { ctl, editor } = access;

  const version = await findVersion(id, ctl.current_version);
  if (!version || !version.form_data) {
    return res.status(403).json({ error: EDIT_MESSAGES.legacy, code: 'locked' });
  }

  let images = null;
  if (isValidRefList(version.image_files, REQUIRED_IMAGES_COUNT)) {
    try {
      const buffers = await Promise.all(version.image_files.map((ref) => readImage(ref.sha256)));
      images = buffers.map(bufferToDataUri);
    } catch (err) {
      console.error(`[opr-edit] gambar versi aktif tidak dapat dibaca - id=${id}`, err.message);
      images = null;
    }
  }

  res.json({
    id,
    current_version: ctl.current_version,
    generated_at: ctl.generated_at,
    edit_expires_at: ctl.edit_expires_at,
    server_time: ctl.server_time,
    editor: editor.kind,
    design_id: version.design_id, // Kemas Kini 5: design versi aktif
    form: version.form_data,
    images,
  });
}

// Middleware sebelum multer bagi PUT /api/opr/:id - tolak awal (tanpa
// menerima muat naik) jika tiada kebenaran / tempoh tamat.
async function preEditCheck(req, res, next) {
  try {
    const id = parseOprId(req.params.id);
    const access = await checkEditAccess(req, id);
    if (!access.ok) return res.status(access.status).json(access.body);
    req.oprEdit = { id, editor: access.editor, token: readTokenFromRequest(req), currentVersion: access.ctl.current_version };
    next();
  } catch (err) {
    next(err);
  }
}

// ===================== PUT /api/opr/:id (multipart) =====================
async function submitEdit(req, res) {
  const startedAt = Date.now();
  const { id, editor, token, currentVersion } = req.oprEdit;
  const files = req.files || [];

  try {
    const { errors: fieldErrors, clean } = validateFields(req.body);
    const errors = { ...fieldErrors };

    const baseVersion = Number(req.body.base_version);
    if (!Number.isInteger(baseVersion) || baseVersion < 1) {
      errors._global = 'Permintaan suntingan tidak sah. Sila muat semula borang Edit.';
    }

    const imageError = validateImageFiles(files);
    if (imageError) errors.images = imageError;
    // Kemas Kini 5: Edit menerima ID design sah sahaja ('random' ditolak);
    // tiada pilihan -> kekal design versi asas (tidak pernah bertukar senyap).
    const designChoice = parseDesignChoice(req.body.design_choice, { allowRandom: false });
    if (!designChoice.ok) errors.design = designChoice.error;

    // Semakan awal versi asas (elak kerja penjanaan sia-sia); semakan muktamad
    // tetap berlaku dalam transaksi commitEditedVersion.
    if (!errors._global && baseVersion !== currentVersion) {
      return res.status(409).json({ error: EDIT_MESSAGES.conflict, code: 'conflict' });
    }

    let baseImageRefs = null;
    let slots = null;
    let designId = null;
    if (!errors._global) {
      const base = await findVersion(id, baseVersion);
      if (!base) {
        return res.status(409).json({ error: EDIT_MESSAGES.conflict, code: 'conflict' });
      }
      if (designChoice.ok) designId = resolveDesignForEdit(designChoice.choice, base.design_id);
      baseImageRefs = isValidRefList(base.image_files, REQUIRED_IMAGES_COUNT) ? base.image_files : [];
      slots = parseImageSlots(req.body.image_slots, baseImageRefs.length, files.length);
      if (!slots && !errors.images) {
        errors.images = baseImageRefs.length === 0 ? EDIT_MESSAGES.imagesUnavailable : MESSAGES_IMAGES_COUNT;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    console.log(`[opr-edit] mula - requestId=${req.oprRequestId} id=${id} base=${baseVersion} editor=${editor.kind} newImages=${files.length} design=${designId}`);

    await pdfSemaphore.acquire();
    try {
      // ---- Susun gambar mengikut slot (kekal / baharu) ----
      let newBuffers;
      let keptBuffers;
      try {
        newBuffers = await processImageBuffers(files);
        keptBuffers = await Promise.all(
          slots.filter((s) => s.kind === 'keep').map((s) => readImage(baseImageRefs[s.index].sha256))
        );
      } catch (err) {
        console.error(`[opr-edit] gagal proses/baca gambar - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat memproses gambar. Sila cuba lagi.' });
      }
      let keptCursor = 0;
      const orderedBuffers = slots.map((s) => (s.kind === 'new' ? newBuffers[s.index] : keptBuffers[keptCursor++]));

      const generated = await generateVerifiedPdf(clean, orderedBuffers.map(bufferToDataUri), req.oprRequestId, designId);
      if (!generated.ok) return res.status(generated.status).json(generated.body);
      const { pdfBuffer, pageCount } = generated;

      // ---- Simpan gambar baharu (gambar dikekalkan guna rujukan sedia ada) ----
      let newRefs;
      try {
        newRefs = (await saveImages(newBuffers)).refs;
      } catch (err) {
        console.error(`[opr-edit] gagal simpan gambar - requestId=${req.oprRequestId}`, err.message);
        return res.status(500).json({ error: 'Ralat menyimpan gambar. Sila cuba lagi.' });
      }
      const imageRefs = slots.map((s) => (s.kind === 'new' ? newRefs[s.index] : baseImageRefs[s.index]));

      // ---- Muat naik PDF versi baharu sebagai FAIL BAHARU (PDF lama tidak disentuh) ----
      const pdfFilename = buildPdfFilename();
      let driveFileId;
      try {
        driveFileId = await uploadPdfToDrive(pdfBuffer, pdfFilename);
      } catch (err) {
        console.error(`[opr-edit] gagal muat naik ke Google Drive - requestId=${req.oprRequestId}`, err.message);
        return res.status(502).json({ error: 'Pembetulan tidak dapat disimpan pada masa ini. Versi semasa tidak berubah. Sila cuba lagi.' });
      }

      // ---- Transaksi DB (semak semula tempoh, kebenaran & versi asas) ----
      let result;
      try {
        result = await commitEditedVersion({
          id,
          baseVersion,
          editor,
          token,
          clean,
          formData: buildFormSnapshot(req.body),
          imageRefs,
          pdfFilename,
          driveFileId,
          designId,
        });
      } catch (err) {
        console.error(`[opr-edit] gagal simpan versi - requestId=${req.oprRequestId}`, err.message);
        await compensateDriveUpload(driveFileId);
        return res.status(500).json({ error: 'Ralat menyimpan pembetulan. Versi semasa tidak berubah. Sila cuba lagi.' });
      }

      if (result.status !== 'ok') {
        await compensateDriveUpload(driveFileId);
        const map = {
          not_found: [404, EDIT_MESSAGES.notFound],
          expired: [403, EDIT_MESSAGES.locked],
          forbidden: [403, EDIT_MESSAGES.forbidden],
          conflict: [409, EDIT_MESSAGES.conflict],
        };
        const [status, error] = map[result.status];
        console.log(`[opr-edit] ditolak semasa simpan - requestId=${req.oprRequestId} id=${id} sebab=${result.status}`);
        return res.status(status).json({ error, code: result.status === 'expired' ? 'locked' : result.status });
      }

      console.log(
        `[opr-edit] selesai - requestId=${req.oprRequestId} id=${id} versi=${result.version} duration=${Date.now() - startedAt}ms ` +
          `pdfSize=${pdfBuffer.length}bytes pageCount=${pageCount}`
      );
      return res.json({
        success: true,
        record: {
          id,
          version: result.version,
          design_id: designId,
          program_name: result.record.program_name,
          view_url: `/api/opr/${id}/pdf`,
          edit_expires_at: result.record.edit_expires_at,
        },
      });
    } finally {
      pdfSemaphore.release();
    }
  } finally {
    await cleanupTemp(req.oprRequestId);
  }
}

async function compensateDriveUpload(driveFileId) {
  const result = await deleteDriveFile(driveFileId);
  if (!result.success) {
    console.error(`[opr-edit] KRITIKAL: compensation delete Drive GAGAL - fail orphan mungkin tertinggal (driveFileId=${driveFileId})`);
  }
}

// Render + jana + sahkan satu halaman. Mesej/log SAMA seperti penjanaan asal.
async function generateVerifiedPdf(clean, imageDataUris, requestId, designId = 'original') {
  let html;
  try {
    html = renderOprHtml(clean, imageDataUris, designId);
  } catch (err) {
    console.error(`[opr] gagal render template - requestId=${requestId}`, err.message);
    return { ok: false, status: 500, body: { error: 'Ralat menyediakan dokumen OPR. Sila cuba lagi.' } };
  }

  let pdfBuffer;
  try {
    pdfBuffer = await renderPdfFromHtml(html);
  } catch (err) {
    console.error(`[opr] gagal jana PDF - requestId=${requestId}`, err.message);
    return { ok: false, status: 500, body: { error: 'Ralat menjana PDF. Sila cuba lagi.' } };
  }

  let pageCount;
  try {
    const doc = await PDFDocument.load(pdfBuffer);
    pageCount = doc.getPageCount();
  } catch (err) {
    console.error(`[opr] gagal sahkan bilangan halaman - requestId=${requestId}`, err.message);
    return { ok: false, status: 500, body: { error: 'Ralat mengesahkan dokumen PDF. Sila cuba lagi.' } };
  }

  if (pageCount !== REQUIRED_PAGE_COUNT) {
    console.error(`[opr] generation ditolak - requestId=${requestId} pageCount=${pageCount} (melebihi 1 halaman)`);
    return {
      ok: false,
      status: 422,
      body: {
        message:
          'Maklumat OPR terlalu panjang untuk dimuatkan dalam satu halaman A4. ' +
          'Sila ringkaskan kandungan atau kurangkan maklumat tambahan.',
      },
    };
  }
  return { ok: true, pdfBuffer, pageCount };
}

// ===================== GET /api/opr/:id/versions =====================
// Sejarah ringkas. Admin: semua OPR (termasuk maklumat audit). Pemegang
// token: hanya OPR sendiri & dalam tempoh 24 jam. Lain-lain: 403.
async function getVersions(req, res) {
  res.set('Cache-Control', 'no-store');
  const id = parseOprId(req.params.id);
  const ctl = id ? await findEditControl(id) : null;
  if (!ctl) return res.status(404).json({ error: EDIT_MESSAGES.notFound });

  const admin = await getSessionAdmin(req);
  if (!admin) {
    const editor = await resolveEditor(req, ctl);
    if (!editor || !ctl.edit_open) return res.status(403).json({ error: EDIT_MESSAGES.forbidden, code: 'forbidden' });
  }

  let versions = await listVersions(id, { includeAudit: Boolean(admin) });
  if (versions.length === 0) {
    // Rekod sebelum Kemas Kini 2 - satu versi asal (tiada baris opr_versions).
    versions = [{ version_no: 1, source: 'create', created_at: ctl.generated_at, design_id: 'original', ...(admin ? { edited_by: 'Penjanaan asal' } : {}) }];
  }
  // Kemas Kini 3: jejak sumber Duplicate - maklumat audit untuk Admin sahaja.
  let duplicatedFromId = null;
  if (admin) {
    const { rows } = await pool.query('SELECT duplicated_from_id FROM opr_records WHERE id = $1', [id]);
    duplicatedFromId = rows[0] ? rows[0].duplicated_from_id : null;
  }
  res.json({
    id,
    current_version: ctl.current_version,
    edit_expires_at: ctl.edit_expires_at,
    can_open_versions: Boolean(admin),
    ...(admin ? { duplicated_from_id: duplicatedFromId } : {}),
    versions,
  });
}

// ===================== GET /api/opr/:id/duplicate-source =====================
// Kemas Kini 3: data borang untuk "Duplicate & Edit" - BACA SAHAJA, medan
// whitelist sahaja (lihat opr.duplicate.js). Kandungan sama seperti yang sudah
// terpapar dalam PDF awam OPR tersebut; tiada token/storan/audit didedahkan.
// Penjanaan rekod baharu tetap melalui POST /api/opr (validasi CREATE penuh).
async function getDuplicateSource(req, res) {
  res.set('Cache-Control', 'no-store');
  const id = parseOprId(req.params.id);
  const source = id ? await buildDuplicateSource(id) : null;
  if (!source) return res.status(404).json({ error: EDIT_MESSAGES.notFound });
  // Tiket sumber bertandatangan (pengesahan jejak Duplicate sahaja - bukan
  // kebenaran baca/edit). Lihat services/opr.duplicateTicket.js.
  const { ticket, expires_at } = issueDuplicateTicket(source.source.id);
  res.json({ ...source, source_ticket: ticket, source_ticket_expires_at: expires_at, server_time: new Date().toISOString() });
}

// ===================== GET /api/opr/:id/versions/:version/pdf =====================
// PDF versi tertentu (termasuk versi lama) - ADMIN SAHAJA (audit). Versi
// aktif untuk umum kekal melalui GET /api/opr/:id/pdf.
async function getVersionPdf(req, res) {
  res.set('Cache-Control', 'private, no-store');
  const admin = await getSessionAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Sila log masuk sebagai Admin.' });

  const id = parseOprId(req.params.id);
  const versionNo = Number(req.params.version);
  if (!id || !Number.isInteger(versionNo) || versionNo < 1 || versionNo > 100000) {
    return res.status(404).json({ error: 'Versi OPR tidak ditemui.' });
  }

  let driveFileId = null;
  let filename = null;
  const version = await findVersion(id, versionNo);
  if (version) {
    driveFileId = version.drive_file_id;
    filename = version.pdf_filename;
  } else if (versionNo === 1) {
    // Rekod lama tanpa baris versi: Versi 1 = PDF pada opr_records.
    const record = await findById(id);
    const ctl = record ? await findEditControl(id) : null;
    if (record && ctl && ctl.current_version === 1) {
      driveFileId = record.drive_file_id;
      filename = record.pdf_filename;
    }
  }
  if (!driveFileId) return res.status(404).json({ error: 'Versi OPR tidak ditemui.' });

  return streamDrivePdf(req, res, { id, driveFileId, filename });
}

module.exports = {
  submitOPR,
  getRecent,
  search,
  getYears,
  getById,
  getPdf,
  cleanupTemp,
  tempDirFor,
  getEditData,
  preEditCheck,
  submitEdit,
  getVersions,
  getVersionPdf,
  getDuplicateSource,
};
