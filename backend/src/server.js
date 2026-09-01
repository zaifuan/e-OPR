const app = require('./app');
const env = require('./config/env');
const pdfService = require('./services/pdf.service');
const { cleanStaleTempOnStartup } = require('./startupCleanup');
const { logStartupStatus: logGoogleDriveStatus } = require('./services/googleDrive.service');

cleanStaleTempOnStartup();
pdfService.warmUp();
logGoogleDriveStatus();

const server = app.listen(env.PORT, () => {
  console.log(`[server] Sistem OPR backend berjalan pada port ${env.PORT} (${env.NODE_ENV})`);
});

// Pastikan Chromium ditutup dengan bersih apabila Docker menghentikan container
// (docker compose down/restart) - elak proses Chromium tertinggal sebagai zombie.
async function shutdown(signal) {
  console.log(`[server] Menerima ${signal}, menutup dengan bersih...`);
  server.close();
  await pdfService.shutdown();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
