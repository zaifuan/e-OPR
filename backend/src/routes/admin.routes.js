const express = require('express');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/admin.controller');
const requireAdminSession = require('../middleware/requireAdminSession');

const router = express.Router();

// Elak brute-force pada login Admin (Bahagian 44 spesifikasi asal)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // hanya percubaan GAGAL dikira - elak admin disekat selepas login berjaya berulang kali
  message: { error: 'Terlalu banyak percubaan log masuk. Sila cuba lagi selepas beberapa minit.' },
});

// Had longgar untuk mutation Admin (delete) - sudah memerlukan sesi authenticated,
// jadi ini sekadar jaring keselamatan am (Bahagian 13), bukan perlindungan utama.
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Sila cuba lagi sebentar lagi.' },
});

router.post('/login', loginLimiter, adminController.login);
router.post('/logout', requireAdminSession, adminController.logout);
router.get('/me', requireAdminSession, adminController.me);

// DELETE kekal dalam namespace /api/admin/... sahaja (Bahagian 11) - bukan
// /api/opr/:id yang public. requireAdminSession ialah perlindungan SEBENAR
// (backend), bukan sekadar sembunyi butang UI (Bahagian 4).
router.delete('/opr/:id', requireAdminSession, mutationLimiter, adminController.deleteOpr);

module.exports = router;
