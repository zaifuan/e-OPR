const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const env = require('./config/env');
const pool = require('./db/pool');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');
const oprRoutes = require('./routes/opr.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Aplikasi akan berada di belakang Cloudflare/reverse proxy dalam production -
// perlu untuk secure cookie & pengesanan IP yang betul (Bahagian 6, dokumen deployment).
if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(helmet());

// Frontend & backend sama origin dalam production (satu container/port) - CORS
// hanya benar-benar diperlukan untuk kemudahan dev tempatan (Vite dev server
// pada port berbeza). Dalam production, TIDAK jatuh balik ke `true` (reflect
// mana-mana Origin) jika APP_BASE_URL tertinggal - gagal TERTUTUP (tiada asal
// dibenarkan) dan bukan gagal TERBUKA, memenuhi arahan "jangan enable
// permissive CORS tanpa sebab" (Bahagian 30, Fasa 6).
const corsOrigin = env.NODE_ENV === 'production' ? env.APP_BASE_URL : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    name: 'opr.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
    },
  })
);

app.use('/api/health', healthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/opr', oprRoutes);

// Endpoint /api/* yang tidak dikenali -> 404 JSON (bukan HTML fallback di bawah)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemui.' });
});

// Static build React (Vite) - disalin ke ./public semasa Docker build (lihat Dockerfile)
const frontendDist = path.join(__dirname, '..', 'public');
app.use(express.static(frontendDist));

// SPA fallback - route selain /api/* diserahkan kepada React Router
app.use((req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(errorHandler);

module.exports = app;
