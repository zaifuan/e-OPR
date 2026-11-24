const crypto = require('crypto');
const pool = require('../db/pool');
const { deleteDriveFile } = require('./googleDrive.service');

// Nama fail unik - convention SAMA seperti sebelum ini (Bahagian 18), tetapi
// kini janakan filename SAHAJA (tiada lagi mkdir/write/rename tempatan -
// Google Drive primary storage, bukan local filesystem).
function buildPdfFilename() {
  const year = new Date().getFullYear();
  const uuid = crypto.randomUUID();
  return `opr-${year}-${uuid}.pdf`;
}

// Simpan metadata OPR ke PostgreSQL. Google Drive upload SUDAH berjaya
// SEBELUM fungsi ini dipanggil (controller memanggil uploadPdfToDrive()
// dahulu - Bahagian 7, langkah E mesti berjaya dahulu).
//
// Compensation (Bahagian 7/33): jika INSERT gagal SELEPAS Drive upload
// berjaya, cuba padam fail Drive orphan tersebut di sini - kekal co-located
// dengan logik "consistency on failure" (pola sama seperti v1 local
// sebelum ini, hanya "local unlink" digantikan "Drive delete").
//
// Kemas Kini 2: INSERT opr_records + INSERT opr_versions (Versi 1) dalam SATU
// transaksi - tiada OPR tanpa Versi 1 atau sebaliknya. edit_expires_at =
// generated_at + 24 jam, dikira oleh JAM DB dalam transaksi yang sama
// (now() tetap sepanjang transaksi -> tepat sama dengan generated_at).
// Kemas Kini 3 (pembetulan akhir): duplicateTicket = { sourceId, nonce } yang
// SUDAH disahkan (opr.duplicateTicket.js) atau null (CREATE biasa).
// Mod Duplicate adalah TEGAS - rekod TIDAK PERNAH disimpan tanpa jejak secara
// senyap:
//   - Baris sumber dikunci (FOR KEY SHARE) dalam transaksi yang sama: jika
//     sumber sudah tiada -> DuplicateSourceMissingError (tiada rekod).
//   - Nonce tiket unik (indeks 010): permintaan serentak/main semula dengan
//     tiket sama -> DuplicateTicketUsedError (tiada rekod kedua).
// Dalam kedua-dua kes, PDF Drive yang baru dimuat naik dibuang (compensation)
// dan ralat dibaling semula untuk dipetakan oleh controller kepada 409.
const TICKET_NONCE_INDEX = 'uq_opr_records_duplicate_ticket_nonce';

class DuplicateTicketUsedError extends Error {
  constructor() {
    super('Tiket Duplicate sudah digunakan.');
    this.name = 'DuplicateTicketUsedError';
  }
}

class DuplicateSourceMissingError extends Error {
  constructor() {
    super('Rekod sumber Duplicate tidak lagi wujud.');
    this.name = 'DuplicateSourceMissingError';
  }
}

async function insertRecordAndVersion(client, { clean, pdfFilename, driveFileId, formData, imageRefs, editTokenHash, ticket, designId }) {
  if (ticket) {
    const src = await client.query('SELECT id FROM opr_records WHERE id = $1 FOR KEY SHARE', [ticket.sourceId]);
    if (src.rowCount === 0) throw new DuplicateSourceMissingError();
  }
  const { rows } = await client.query(
    `INSERT INTO opr_records (program_name, program_date, organizer, prepared_by, pdf_filename, drive_file_id, program_schedule, additional_info,
                              prepared_by_position, verified_by_position,
                              edit_expires_at, edit_token_hash, current_version, duplicated_from_id, duplicate_ticket_nonce,
                              design_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10,
             now() + interval '24 hours', $11, 1, $12::int, $13::varchar, $14)
     RETURNING id, program_name, program_date, organizer, prepared_by, generated_at, edit_expires_at, now() AS server_time,
               duplicated_from_id`,
    [
      clean.program_name,
      clean.program_date_start, // Pembaharuan 02: tarikh PALING AWAL bagi tarikh berasingan
      clean.organizer,
      clean.prepared_by,
      pdfFilename,
      driveFileId,
      clean.schedule ? JSON.stringify(clean.schedule) : null, // jadual berstruktur (005)
      clean.additional_info ? JSON.stringify(clean.additional_info) : null, // LAIN-LAIN (NYATAKAN) (006)
      clean.prepared_by_position || null, // Jawatan (007)
      clean.verified_by_position || null,
      editTokenHash,
      ticket ? ticket.sourceId : null,
      ticket ? ticket.nonce : null,
      designId, // Kemas Kini 5: design SEBENAR (bukan 'random')
    ]
  );
  const record = rows[0];
  await client.query(
    `INSERT INTO opr_versions (opr_id, version_no, source, form_data, image_files, pdf_filename, drive_file_id, created_at, design_id)
     VALUES ($1, 1, 'create', $2::jsonb, $3::jsonb, $4, $5, $6, $7)`,
    [
      record.id,
      formData ? JSON.stringify(formData) : null,
      imageRefs ? JSON.stringify(imageRefs) : null,
      pdfFilename,
      driveFileId,
      record.generated_at,
      designId,
    ]
  );
  return record;
}

async function archiveOprRecord({ clean, pdfFilename, driveFileId, formData = null, imageRefs = null, editTokenHash = null, duplicateTicket = null, designId = 'original' }) {
  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    let record;
    try {
      record = await insertRecordAndVersion(client, {
        clean,
        pdfFilename,
        driveFileId,
        formData,
        imageRefs,
        editTokenHash,
        ticket: duplicateTicket,
        designId,
      });
    } catch (err) {
      if (duplicateTicket && err.code === '23505' && err.constraint === TICKET_NONCE_INDEX) {
        throw new DuplicateTicketUsedError();
      }
      throw err;
    }
    await client.query('COMMIT');
    return { ...record, pdfFilename };
  } catch (err) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch {
      // sambungan mungkin sudah rosak
    }
    console.error(`[archive] INSERT gagal selepas Drive upload berjaya - cuba compensation delete (driveFileId=${driveFileId}) sebab=${err.name}`);
    const compensation = await deleteDriveFile(driveFileId);
    if (compensation.success) {
      console.log(`[archive] compensation delete Drive berjaya - fail orphan dibuang (driveFileId=${driveFileId})`);
    } else {
      console.error(`[archive] KRITIKAL: compensation delete Drive GAGAL - fail orphan mungkin tertinggal di Drive (driveFileId=${driveFileId})`);
    }
    throw err;
  } finally {
    if (client) client.release();
  }
}

module.exports = { archiveOprRecord, buildPdfFilename, DuplicateTicketUsedError, DuplicateSourceMissingError };
