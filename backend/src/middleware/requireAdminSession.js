// Backend gate untuk route Admin. Frontend juga akan sembunyikan UI yang
// berkaitan, tetapi pengesahan sebenar mesti berlaku di sini - jangan
// bergantung semata-mata kepada frontend (Bahagian 6 spesifikasi).
function requireAdminSession(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({ error: 'Sila log masuk sebagai Admin.' });
  }
  next();
}

module.exports = requireAdminSession;
