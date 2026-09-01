const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const { REQUIRED_IMAGES, MAX_IMAGE_BYTES, MESSAGES } = require('../constants/opr');
const oprController = require('../controllers/opr.controller');

const router = express.Router();

// Longgar sengaja - beberapa guru mungkin berkongsi satu IP awam sekolah (NAT).
// 40 permintaan/10 minit ~= 240/jam setiap IP, cukup untuk penggunaan sebenar
// tetapi masih menyekat automated abuse. Dikekalkan sama seperti Fasa 2/3 -
// tiada sebab untuk ubah (Bahagian 30 spesifikasi Fasa 4).
const oprLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, errors: { _global: 'Terlalu banyak percubaan. Sila cuba lagi sebentar lagi.' } },
});

// Had berasingan untuk endpoint baca (search/recent/view/download) - jauh lebih
// murah daripada generation PDF, jadi longgar tapi masih ada had (Bahagian 30).
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Sila cuba lagi sebentar lagi.' },
});

function assignRequestId(req, res, next) {
  req.oprRequestId = crypto.randomUUID();
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(env.TEMP_STORAGE_PATH, req.oprRequestId);
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename: (req, file, cb) => {
    // Nama rawak - tiada extension, tiada kaitan dengan nama fail asal.
    // Jenis fail sebenar disahkan berasingan melalui magic-byte (bukan nama fail).
    cb(null, crypto.randomBytes(16).toString('hex'));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: REQUIRED_IMAGES },
}).array('images', REQUIRED_IMAGES);

// Multer dibalut secara manual (bukan sebagai middleware deklaratif terus)
// supaya ralat multer (had saiz/bilangan fail) boleh diterjemah ke mesej Bahasa
// Melayu DAN folder sementara dibersihkan di tempat yang sama - bukan bergantung
// pada global error handler yang tidak tahu tentang path OPR.
router.post('/', oprLimiter, assignRequestId, (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      await oprController.cleanupTemp(req.oprRequestId);

      if (err instanceof multer.MulterError) {
        const map = {
          LIMIT_FILE_SIZE: MESSAGES.images.size,
          LIMIT_FILE_COUNT: MESSAGES.images.count,
          LIMIT_UNEXPECTED_FILE: MESSAGES.images.count,
        };
        return res.status(400).json({
          valid: false,
          errors: { images: map[err.code] || 'Ralat memuat naik gambar.' },
        });
      }

      return next(err);
    }

    try {
      await oprController.submitOPR(req, res);
    } catch (handlerErr) {
      next(handlerErr);
    }
  });
});

// PENTING: /recent dan /search mesti didaftar SEBELUM /:id - jika tidak,
// Express akan tafsir "recent"/"search" sebagai nilai :id (Express tidak
// membezakan literal vs param berdasarkan susunan takrif, bukan kekhususan).
router.get('/recent', readLimiter, wrapAsync(oprController.getRecent));
router.get('/search', readLimiter, wrapAsync(oprController.search));
router.get('/years', readLimiter, wrapAsync(oprController.getYears));
router.get('/:id/pdf', readLimiter, wrapAsync(oprController.getPdf));
router.get('/:id', readLimiter, wrapAsync(oprController.getById));

// Express 5 sudah auto-forward async rejection untuk route handler biasa,
// tetapi wrapper ini kekal sebagai jaminan eksplisit + konsisten merentasi
// semua route baca (tidak bergantung semata-mata pada tingkah laku versi).
function wrapAsync(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = router;
