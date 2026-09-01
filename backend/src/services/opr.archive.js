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
async function archiveOprRecord({ clean, pdfFilename, driveFileId }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO opr_records (program_name, program_date, organizer, prepared_by, pdf_filename, drive_file_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, program_name, program_date, organizer, prepared_by, generated_at`,
      [clean.program_name, clean.program_date_start, clean.organizer, clean.prepared_by, pdfFilename, driveFileId]
    );
    return { ...rows[0], pdfFilename };
  } catch (err) {
    console.error(`[archive] INSERT gagal selepas Drive upload berjaya - cuba compensation delete (driveFileId=${driveFileId})`);
    const compensation = await deleteDriveFile(driveFileId);
    if (compensation.success) {
      console.log(`[archive] compensation delete Drive berjaya - fail orphan dibuang (driveFileId=${driveFileId})`);
    } else {
      console.error(`[archive] KRITIKAL: compensation delete Drive GAGAL - fail orphan mungkin tertinggal di Drive (driveFileId=${driveFileId})`);
    }
    throw err;
  }
}

module.exports = { archiveOprRecord, buildPdfFilename };
