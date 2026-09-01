const pool = require('../db/pool');
const { deleteDriveFile } = require('./googleDrive.service');

// Strategi (Bahagian 16, dipilih & diterangkan seperti diminta):
//
//   BEGIN -> SELECT ... FOR UPDATE -> padam fail Drive -> DELETE DB -> COMMIT
//
// Drive dipadam DAHULU, DB KEMUDIAN. Sebab:
//   - Jika Drive delete GAGAL (ralat transient/network, BUKAN 404): DB
//     TIDAK dipadam. Rekod kekal wujud, admin boleh cuba "Padam" semula
//     kemudian - tiada data hilang, tiada fail Drive orphan tanpa rekod.
//   - Jika Drive delete BERJAYA (atau fail sudah 404 - dianggap kejayaan,
//     idempotent) tetapi DELETE DB gagal (ralat DB jarang berlaku): rekod
//     DB kekal wujud tetapi kini menunjuk fail yang sudah tiada di Drive.
//     Ini KELEMAHAN yang diketahui - tetapi SELF-HEALING: jika admin cuba
//     "Padam" rekod yang SAMA sekali lagi, deleteDriveFile() akan terima
//     404 (fail sudah tiada) yang DIANGGAP KEJAYAAN, lalu DELETE DB
//     diteruskan dan berjaya pada percubaan kedua. Tiada compensation
//     tambahan diperlukan kerana sifat idempotent 404 ini sudah mencukupi
//     untuk pulih tanpa campur tangan manual.
//   - SELECT FOR UPDATE dalam transaction mengekalkan row-lock sepanjang
//     panggilan Drive (elak race dua permintaan padam serentak untuk id
//     yang sama menyebabkan dua panggilan Drive delete berlumba).
async function deleteOprRecord(id) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT id, program_name, drive_file_id FROM opr_records WHERE id = $1 FOR UPDATE',
      [id]
    );
    const record = rows[0];

    if (!record) {
      await client.query('ROLLBACK');
      return { status: 'not_found' };
    }

    let driveMissing = false;
    if (record.drive_file_id) {
      const driveResult = await deleteDriveFile(record.drive_file_id);
      if (!driveResult.success) {
        await client.query('ROLLBACK');
        console.error(`[delete] Drive delete gagal untuk id=${id} - DB TIDAK dipadam (boleh cuba lagi)`);
        throw Object.assign(new Error('OPR gagal dipadam. Sila cuba semula.'), { status: 500 });
      }
      driveMissing = Boolean(driveResult.alreadyMissing);
    }

    await client.query('DELETE FROM opr_records WHERE id = $1', [id]);
    await client.query('COMMIT');

    return { status: 'deleted', record, driveMissing };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // sambungan mungkin sudah rosak - tiada tindakan lanjut
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { deleteOprRecord };
