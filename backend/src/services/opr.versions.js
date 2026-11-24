const pool = require('../db/pool');
const { tokenMatches } = require('./opr.editAuth');

// Kemas Kini 2: akses data suntingan & sejarah versi OPR.

// Maklumat kawalan suntingan bagi satu OPR. edit_open dikira oleh JAM DB
// (bukan jam pelayar/telefon dan bukan jam proses Node) supaya semua semakan
// tempoh menggunakan satu sumber masa yang konsisten.
async function findEditControl(id) {
  const { rows } = await pool.query(
    `SELECT id, program_name, generated_at, edit_expires_at, edit_token_hash, current_version,
            (edit_expires_at IS NOT NULL AND edit_expires_at > now()) AS edit_open,
            now() AS server_time
     FROM opr_records WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findVersion(oprId, versionNo) {
  const { rows } = await pool.query(
    `SELECT id, opr_id, version_no, source, form_data, image_files, pdf_filename, drive_file_id,
            edited_by_admin_id, created_at, design_id
     FROM opr_versions WHERE opr_id = $1 AND version_no = $2`,
    [oprId, versionNo]
  );
  return rows[0] || null;
}

// Sejarah ringkas. `includeAudit` (Admin sahaja) menambah maklumat audit.
async function listVersions(oprId, { includeAudit = false } = {}) {
  const { rows } = await pool.query(
    `SELECT v.version_no, v.source, v.created_at, v.edited_by_admin_id, a.name AS edited_by_admin_name, v.design_id,
            (v.image_files IS NOT NULL) AS has_images
     FROM opr_versions v
     LEFT JOIN admins a ON a.id = v.edited_by_admin_id
     WHERE v.opr_id = $1
     ORDER BY v.version_no DESC`,
    [oprId]
  );
  return rows.map((r) => {
    const item = { version_no: r.version_no, source: r.source, created_at: r.created_at, design_id: r.design_id };
    if (includeAudit) {
      item.edited_by = r.source === 'create' ? 'Penjanaan asal' : r.edited_by_admin_id ? `Admin: ${r.edited_by_admin_name || r.edited_by_admin_id}` : 'Guru (pautan edit)';
    }
    return item;
  });
}

// Simpan versi baharu secara atomik. Dipanggil SELEPAS PDF baharu berjaya
// dijana & dimuat naik ke Drive. Semua semakan diulang DI DALAM transaksi
// dengan kunci baris (SELECT ... FOR UPDATE):
//   - rekod masih wujud
//   - tempoh 24 jam belum tamat (jam DB, pada saat simpanan)
//   - kebenaran masih sah (token sepadan / Admin masih aktif)
//   - versi asas sama dengan versi aktif (optimistic concurrency) - dua
//     suntingan serentak: yang kedua mendapat 'conflict', bukan menimpa
//     perubahan pertama secara senyap; nombor versi kekal berurutan.
// Pulangan: { status: 'ok', version, ... } | { status: 'not_found'|'expired'|'forbidden'|'conflict' }.
// Jika status bukan 'ok', TIADA perubahan DB berlaku (ROLLBACK) - versi aktif
// sebelumnya kekal sah; pemanggil bertanggungjawab membuang fail Drive baharu.
async function commitEditedVersion({ id, baseVersion, editor, token, clean, formData, imageRefs, pdfFilename, driveFileId, designId = 'original' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, current_version, edit_token_hash,
              (edit_expires_at IS NOT NULL AND edit_expires_at > now()) AS edit_open
       FROM opr_records WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const row = rows[0];
    const bail = async (status) => {
      await client.query('ROLLBACK');
      return { status };
    };

    if (!row) return bail('not_found');
    if (!row.edit_open) return bail('expired');

    if (editor.kind === 'token') {
      if (!tokenMatches(token, row.edit_token_hash)) return bail('forbidden');
    } else if (editor.kind === 'admin') {
      const admin = await client.query('SELECT 1 FROM admins WHERE id = $1 AND is_active = true', [editor.adminId]);
      if (admin.rowCount === 0) return bail('forbidden');
    } else {
      return bail('forbidden');
    }

    if (row.current_version !== baseVersion) return bail('conflict');

    const nextVersion = row.current_version + 1;
    const inserted = await client.query(
      `INSERT INTO opr_versions (opr_id, version_no, source, form_data, image_files, pdf_filename, drive_file_id, edited_by_admin_id, design_id)
       VALUES ($1, $2, 'edit', $3::jsonb, $4::jsonb, $5, $6, $7, $8)
       RETURNING created_at`,
      [id, nextVersion, JSON.stringify(formData), JSON.stringify(imageRefs), pdfFilename, driveFileId, editor.adminId, designId]
    );

    // opr_records mencerminkan versi aktif. generated_at & edit_expires_at
    // SENGAJA tidak disentuh - suntingan tidak memperbaharui tempoh 24 jam.
    const updated = await client.query(
      `UPDATE opr_records SET
         program_name = $2, program_date = $3, organizer = $4, prepared_by = $5,
         pdf_filename = $6, drive_file_id = $7, program_schedule = $8::jsonb, additional_info = $9::jsonb,
         prepared_by_position = $10, verified_by_position = $11,
         current_version = $12, updated_at = $13, design_id = $14
       WHERE id = $1
       RETURNING id, program_name, program_date, organizer, prepared_by, generated_at, edit_expires_at, current_version`,
      [
        id,
        clean.program_name,
        clean.program_date_start,
        clean.organizer,
        clean.prepared_by,
        pdfFilename,
        driveFileId,
        clean.schedule ? JSON.stringify(clean.schedule) : null,
        clean.additional_info ? JSON.stringify(clean.additional_info) : null,
        clean.prepared_by_position || null,
        clean.verified_by_position || null,
        nextVersion,
        inserted.rows[0].created_at,
        designId, // Kemas Kini 5: design versi aktif
      ]
    );

    await client.query('COMMIT');
    return { status: 'ok', version: nextVersion, record: updated.rows[0] };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // sambungan mungkin sudah rosak
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { findEditControl, findVersion, listVersions, commitEditedVersion };
