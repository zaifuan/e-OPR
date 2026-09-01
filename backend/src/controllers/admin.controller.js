const adminService = require('../services/admin.service');
const { deleteOprRecord } = require('../services/opr.delete');

async function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Sila masukkan username dan password.' });
  }

  const admin = await adminService.findByUsername(username);
  if (!admin || !admin.is_active) {
    return res.status(401).json({ error: 'Username atau password tidak sah.' });
  }

  const valid = await adminService.verifyPassword(admin, password);
  if (!valid) {
    return res.status(401).json({ error: 'Username atau password tidak sah.' });
  }

  // regenerate() elak session fixation - id sesi baru diberi selepas login berjaya
  req.session.regenerate((err) => {
    if (err) {
      console.error('[admin.login] ralat session regenerate', err);
      return res.status(500).json({ error: 'Ralat pelayan. Sila cuba lagi.' });
    }

    req.session.adminId = admin.id;
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('[admin.login] ralat session save', saveErr);
        return res.status(500).json({ error: 'Ralat pelayan. Sila cuba lagi.' });
      }
      return res.json({ id: admin.id, name: admin.name, username: admin.username });
    });
  });
}

function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('[admin.logout] ralat', err);
      return res.status(500).json({ error: 'Ralat pelayan. Sila cuba lagi.' });
    }
    res.clearCookie('opr.sid');
    return res.json({ success: true });
  });
}

async function me(req, res) {
  const admin = await adminService.findById(req.session.adminId);
  if (!admin) {
    return res.status(401).json({ error: 'Tiada sesi aktif.' });
  }
  return res.json({ id: admin.id, name: admin.name, username: admin.username });
}

async function deleteOpr(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Rekod OPR tidak ditemui.' });
  }

  console.log(`[delete] mula - id=${id} adminId=${req.session.adminId}`);

  let result;
  try {
    result = await deleteOprRecord(id);
  } catch (err) {
    console.error(`[delete] gagal - id=${id}`, err.message);
    return res.status(err.status || 500).json({ error: err.message || 'OPR gagal dipadam. Sila cuba semula.' });
  }

  if (result.status === 'not_found') {
    return res.status(404).json({ error: 'Rekod OPR tidak ditemui.' });
  }

  console.log(
    `[delete] selesai - id=${id} program="${result.record.program_name}" pdfMissing=${result.pdfMissing}`
  );

  return res.json({
    success: true,
    message: result.pdfMissing
      ? 'Rekod dipadam. Fail PDF asal tidak ditemui.'
      : 'OPR berjaya dipadam.',
  });
}

module.exports = { login, logout, me, deleteOpr };
