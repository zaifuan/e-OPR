require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Environment variable ${name} diperlukan tetapi tidak ditetapkan.`);
  }
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3070', 10),
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  PDF_STORAGE_PATH: process.env.PDF_STORAGE_PATH || '/app/data/pdfs',
  TEMP_STORAGE_PATH: process.env.TEMP_STORAGE_PATH || '/app/data/tmp',
  CHROMIUM_PATH: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
  APP_BASE_URL: process.env.APP_BASE_URL || '',
  TRUST_PROXY: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',
};

module.exports = env;
