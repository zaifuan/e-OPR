# ============================================================
# Sistem OPR - Dockerfile (multi-stage)
#
# Stage 1: build frontend React/Vite -> static files (dist/)
# Stage 2: install backend production deps + salin static build
#          -> satu image yang menjalankan Express, menghidangkan
#             API dan frontend pada satu port sahaja.
#
# Guna: docker compose build && docker compose up -d
# Tiada build diperlukan pada komputer tempatan - semuanya
# berlaku di dalam Docker semasa `docker compose build`.
# ============================================================

# ---------- Stage 1: Build frontend ----------
FROM node:24-alpine AS frontend-build
WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Backend production ----------
FROM node:24-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Chromium (untuk Puppeteer/PDF Fasa 3) + font cetakan + dumb-init.
# Guna Chromium SISTEM (apk) - BUKAN download Puppeteer sendiri - kerana
# puppeteer-core (bukan puppeteer penuh) digunakan dalam package.json backend.
#   - nss/freetype/harfbuzz/ca-certificates: keperluan runtime Chromium standard
#   - ttf-liberation: font metric-compatible Arial/Times/Courier (diminta khusus)
#   - ttf-freefont: fallback liputan Unicode lebih luas
#   - dumb-init: init PID 1 yang betul - Puppeteer melancar & menutup proses
#     Chromium berulang kali sepanjang hayat container; tanpa init yang betul,
#     proses zombie/anak yang tidak di-reap boleh terkumpul dari semasa ke semasa.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-liberation \
    ttf-freefont \
    dumb-init

ENV CHROMIUM_PATH=/usr/bin/chromium-browser

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
# Hasil build frontend (Stage 1) disalin ke ./public - dihidangkan terus oleh Express (lihat src/app.js)
COPY --from=frontend-build /build/frontend/dist ./public

# Direktori data (bind mount akan menimpa /app/data/pdfs di docker-compose.yml;
# /app/data/tmp kekal di dalam container - sengaja TIDAK persistent)
RUN mkdir -p /app/data/pdfs /app/data/tmp && chown -R node:node /app

# Jalankan sebagai user bukan-root (disediakan terbina dalam image node:alpine)
USER node

EXPOSE 3070

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
