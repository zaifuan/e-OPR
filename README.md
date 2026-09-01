# Sistem OPR — README Production

**SABK Maahad Al-Khair Lil Banat (AFT6003)**
Status: Production-ready · Deployment manual melalui WinSCP

---

## 1. Ringkasan Sistem

Sistem OPR menukar proses penyediaan laporan program (One Page Report) daripada kerja manual kepada borang ringkas → PDF A4 satu-halaman automatik.

- **Guru** (tiada login): Buat OPR, cari rekod, lihat PDF, muat turun PDF.
- **Admin** (login): semua di atas + padam rekod secara kekal.
- **PDF final ialah rekod rasmi** — disimpan kekal di `/data/opr/pdfs`. PostgreSQL hanya menyimpan metadata/index untuk carian (`program_name`, `program_date`, `prepared_by`, `pdf_filename`, `pdf_path`, `generated_at`). Gambar asal **tidak** disimpan selepas PDF berjaya dijana.

## 2. Keperluan Server

- Ubuntu Server 24.04 LTS
- Docker + Docker Compose v2 (`docker compose`)
- Cloudflare Tunnel (`cloudflared`) **sedia ada** — Fasa 6 menambah kepadanya, bukan cipta baharu
- Akses SSH (Termius) + WinSCP

## 3. Struktur Docker

Dua servis sahaja:

```
opr-app        # React (static build) + Express + Puppeteer + Chromium + Sharp
opr-postgres   # postgres:16-alpine, TIADA port terdedah ke host
```

`opr-app` dibina melalui Dockerfile multi-stage: Stage 1 (`node:24-alpine`) membuild frontend Vite; Stage 2 memasang dependency backend + Chromium sistem (`apk add chromium`) + menyalin hasil build Stage 1 ke `./public`, dihidangkan terus oleh Express pada satu port. Container berjalan sebagai `USER node` (UID/GID 1000:1000) — **bukan root**.

## 4. Persistent Storage

```
/data/opr/postgres   -> data PostgreSQL
/data/opr/pdfs       -> arkib PDF rasmi (kekal - tiada expiry)
```

Kedua-dua bind mount ini berada **di luar** Docker sepenuhnya — kekal walau `container restart`, `container recreate`, `docker compose build` semula, atau `server reboot`.

## 5. Permission (Jalankan SEKALI sahaja, semasa persediaan server)

```bash
sudo mkdir -p /data/opr/postgres /data/opr/pdfs

# postgres:16-alpine: proses Postgres berjalan sebagai UID/GID 70 (disahkan
# daripada Dockerfile rasmi docker-library/postgres - Alpine guna 70, BUKAN
# 999 seperti varian Debian).
sudo chown -R 70:70 /data/opr/postgres
sudo chmod 700 /data/opr/postgres

# opr-app berjalan sebagai UID/GID 1000 (user "node" terbina dalam image
# node:alpine, disahkan daripada Dockerfile rasmi nodejs/docker-node).
sudo chown -R 1000:1000 /data/opr/pdfs
sudo chmod 700 /data/opr/pdfs
```

**Jangan** guna `chmod 777`. Mod `700` bermakna hanya pemilik boleh baca/tulis — pengguna lain pada host tiada akses.

---

## 6. Upload Melalui WinSCP

1. Muat turun `opr-system-production.zip` yang diserahkan.
2. Buka WinSCP, sambung ke Ubuntu Server.
3. Upload ZIP ke `~/uploads/` (contoh lokasi staging).

## 7. Extract ZIP

```bash
ssh <user>@<server>
mkdir -p ~/apps/opr-system
cd ~/apps/opr-system
unzip ~/uploads/opr-system-production.zip
```

> Struktur ZIP sudah disahkan **rata** (fail terus di root ZIP) — bukan `opr-system/opr-system/...`. Jika `unzip` mencipta folder `opr-system/` di dalam `~/apps/opr-system/`, pindahkan kandungannya satu tahap ke atas (`mv opr-system/* opr-system/.[^.]* . && rmdir opr-system`) sebelum teruskan.

## 8. Production `.env`

```bash
cp .env.example .env
nano .env
```

| Pembolehubah | Wajib diubah? | Catatan |
|---|---|---|
| `NODE_ENV` | Tidak | Kekalkan `production` |
| `PORT` | Mungkin | Elak konflik dengan aplikasi sedia ada anda |
| `POSTGRES_DB` / `POSTGRES_USER` | Tidak | Boleh kekal `opr` / `opr_user` |
| `POSTGRES_PASSWORD` | **Ya** | Password kukuh — lihat Bahagian 9 |
| `DATABASE_URL` | **Ya** | Password **mesti sama** dengan `POSTGRES_PASSWORD`. Hostname `opr-postgres` = nama servis, jangan tukar |
| `SESSION_SECRET` | **Ya** | Lihat Bahagian 9 |
| `PDF_STORAGE_PATH` / `TEMP_STORAGE_PATH` | Tidak | Laluan dalam container, kekal lalai |
| `CHROMIUM_PATH` | Tidak | Dockerfile sudah tetapkan lalai betul |
| `APP_BASE_URL` | **Ya** | `https://opr.byzaifuan.com` |
| `TRUST_PROXY` | Tidak | Kekalkan `1` — lihat Bahagian 27 |

## 9. Session Secret & Password

```bash
openssl rand -hex 32
```

Guna hasil arahan ini untuk `SESSION_SECRET` (boleh lebih panjang). Untuk `POSTGRES_PASSWORD`, guna password kukuh unik — **jangan** guna `postgres`, `password`, `123456`, `admin`. Elakkan aksara `@ : /` dalam password (menyukarkan `DATABASE_URL`).

---

## 10. Docker Build

```bash
cd ~/apps/opr-system
docker compose build
```

Ini melakukan **semua** kerja build (npm ci, Vite production build, dependency backend, pemasangan Chromium) di dalam Docker — komputer/server anda tidak perlu Node.js/npm dipasang terus.

## 11. Start Containers

```bash
docker compose up -d
docker compose ps
```

Dijangka: `opr-app` dan `opr-postgres` kedua-duanya `running` (dan lama-kelamaan `healthy` setelah healthcheck pertama lulus, ~15-30 saat).

## 12. Migration

```bash
docker compose exec opr-app npm run migrate
```

Selamat dijalankan berulang kali (idempotent — disahkan semasa Fasa 6: dijalankan dua kali terhadap DB sedia ada berisi data, tiada jadual berganda, tiada data hilang).

## 13. Create Admin

```bash
docker compose exec -it opr-app npm run create-admin
```

Ikut arahan (Nama, Username, Password ≥12 aksara, input disembunyikan). **Tiada Admin lalai** — anda mesti cipta sendiri.

## 14. Health Check

```bash
curl http://127.0.0.1:3070/api/health
# Dijangka: {"status":"ok","database":"connected"}
```

---

## 15. Local Functional Test (SEBELUM Cloudflare)

Wajib lulus dahulu sebelum menyentuh Cloudflare (Bahagian 69 spesifikasi):

```bash
# 1. Health
curl http://127.0.0.1:3070/api/health

# 2. Admin login - PENTING: tambah header X-Forwarded-Proto:https secara
#    manual untuk simulasi TEPAT keadaan production di sebalik Cloudflare
#    Tunnel (lihat Bahagian 26 - cookie "secure" tidak akan ditetapkan tanpa
#    header ini, kerana sambungan tempatan ini sememangnya HTTP biasa).
curl -i -X POST http://127.0.0.1:3070/api/admin/login \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-Proto: https" \
  -d '{"username":"<username-admin-anda>","password":"<password-admin-anda>"}'
# Dijangka: 200 + header Set-Cookie mengandungi "Secure; HttpOnly; SameSite=Lax"

# 3. Generate OPR (1 gambar) - guna gambar sebenar
curl -X POST http://127.0.0.1:3070/api/opr \
  -F "program_name=Ujian Deployment" -F "organizer=ICT" -F "program_date=2026-01-01" \
  -F "start_time=09:00" -F "end_time=10:00" -F "location=Pejabat" \
  -F "participants=Ujian" -F "involvement=Ujian" -F "summary=Ujian deployment pertama" \
  -F "prepared_by=Admin" -F "verified_by=Admin" \
  -F "images=@/path/ke/gambar.jpg;type=image/jpeg"
# Dijangka: 201 + {"success":true,"record":{...,"view_url":"/api/opr/<id>/pdf"}}
```

Jika Test 3 berjaya, ini mengesahkan **sekaligus**: PostgreSQL, Puppeteer, Chromium, Sharp, satu-halaman PDF, storan kekal, dan metadata DB — semuanya berfungsi.

## 16. Chromium/Puppeteer Test (Paling Kritikal — Belum Diuji Docker Sebenar)

> ⚠️ Chromium dalam Alpine Docker **belum pernah diuji pada Docker sebenar** semasa pembangunan (sandbox pembangunan tiada Docker). Konfigurasi disahkan betul melalui: (a) semakan Dockerfile rasmi `docker-library/postgres` dan pakej Alpine `chromium`/font yang konsisten merentasi pelbagai sumber, dan (b) ujian fungsional PENUH terhadap Chromium **sebenar** (bukan Alpine, tapi library `puppeteer-core` yang SAMA persis dengan kod production) sepanjang Fasa 3-5. **Sila jalankan langkah ini SEBAIK SAHAJA `docker compose up -d` berjaya, sebelum meneruskan ke Cloudflare:**

```bash
# 1. Sahkan Chromium wujud pada path yang CHROMIUM_PATH jangkakan
docker compose exec opr-app which chromium-browser

# 2. Jika arahan di atas GAGAL, cuba:
docker compose exec opr-app sh -c "find / -iname 'chromium*' -type f 2>/dev/null"
# Kemudian kemas kini CHROMIUM_PATH dalam .env kepada laluan sebenar,
# docker compose up -d semula.

# 3. Test PDF generation sebenar (Bahagian 15, Test 3) - jika ini berjaya,
#    Chromium + Puppeteer + Sharp semuanya disahkan berfungsi dalam Docker.
```

## 17. Cloudflare Tunnel Sedia Ada — SEMAK DAHULU, JANGAN ANDAI

**Jangan cipta tunnel baharu.** Tunnel sedia ada sudah mengendalikan `adminjadualganti`, `smartirab`, `tempahanbilikmedia`, dan lain-lain — Fasa 6 hanya **menambah** `opr.byzaifuan.com` kepadanya.

```bash
# Tentukan cloudflared berjalan sebagai systemd service PADA HOST...
sudo systemctl status cloudflared

# ...atau sebagai container Docker
docker ps | grep cloudflared
```

**Jika systemd (host)**: cari config sebenar melalui `systemctl cat cloudflared` (jangan andai `/etc/cloudflared/config.yml` — semak arahan `--config` sebenar dalam output). Jika `config.yml` digunakan, tambah:

```yaml
- hostname: opr.byzaifuan.com
  service: http://localhost:3070
```

**sebelum** baris `- service: http_status:404` (mesti kekal PALING AKHIR).

**Jika diurus melalui Cloudflare Zero Trust Dashboard** (bukan config.yml tempatan): tambah Public Hostname `opr.byzaifuan.com` → `http://localhost:3070` melalui dashboard, bukan edit fail.

**Jika cloudflared dalam Docker container**: `localhost:3070` di dalam container itu merujuk kepada container itu sendiri, BUKAN host — perlu tentukan network Docker sebenar (host gateway / Docker network sedia ada) sebelum konfigurasi. Jangan ubah architecture Cloudflare aplikasi lain untuk menampung ini.

## 18. Tambah `opr.byzaifuan.com`

DNS CNAME yang sedia ada menunjuk ke `fdbd7946-4847-447e-8ce4-5b82b9f5ac62.cfargotunnel.com`. **Jika menambah Public Hostname melalui dashboard secara automatik mencipta DNS route, JANGAN tambah CNAME manual kedua** — semak dahulu sebelum bertindak, elak duplicate DNS record.

## 19. HTTPS Production Test

```bash
curl https://opr.byzaifuan.com/api/health
```

Kemudian buka `https://opr.byzaifuan.com` di browser — uji Utama, Buat OPR, Rekod OPR, Admin (bukan `http://<ip-server>:3070` — port localhost hanya untuk testing dalaman/asal tunnel).

---

## 20. Backup PostgreSQL

```bash
docker compose exec -T opr-postgres pg_dump -U opr_user opr > opr-db-$(date +%F).sql
```

## 21. Backup PDF

```bash
sudo tar -czf opr-pdfs-$(date +%F).tar.gz -C /data/opr pdfs
```

> **PDF dahulu, DB kemudian** (urutan di atas) — meminimumkan risiko backup DB merujuk PDF yang belum sempat di-backup. Simpan kedua-dua fail bersama (backup tidak lengkap tanpa kedua-duanya). Cadangan: jadualkan harian melalui `cron`, simpan salinan di luar server (cth. storan luaran/cloud peribadi anda).

Elak hentikan PostgreSQL sebelum `pg_dump` — tidak perlu, `pg_dump` selamat dijalankan terhadap database yang aktif.

## 22. Restore PostgreSQL

```bash
# Sediakan database kosong (jika belum wujud)
docker compose exec -T opr-postgres psql -U opr_user -c "CREATE DATABASE opr;"

# Restore
cat opr-db-2026-08-27.sql | docker compose exec -T opr-postgres psql -U opr_user opr

# Jalankan migration (selamat walau data sudah wujud - idempotent)
docker compose exec opr-app npm run migrate
```

## 23. Restore PDF

```bash
sudo tar -xzf opr-pdfs-2026-08-27.tar.gz -C /data/opr
sudo chown -R 1000:1000 /data/opr/pdfs
sudo chmod 700 /data/opr/pdfs
```

Sahkan struktur subdirektori tahun (`/data/opr/pdfs/2026/`, dsb.) kekal selepas extract.

---

## 24. Update Production Melalui WinSCP

```bash
# 1. Backup dahulu (Bahagian 20-21)
# 2. Upload opr-system-production-vNEXT.zip ke ~/uploads/ melalui WinSCP
# 3. Extract KE DIREKTORI SAMA (.env sedia ada TIDAK disentuh - unzip
#    hanya menimpa fail yang wujud dalam ZIP, tidak pernah memadam fail
#    lain seperti .env yang bukan sebahagian ZIP)
cd ~/apps/opr-system
unzip ~/uploads/opr-system-production-vNEXT.zip

# 4. Build & start semula
docker compose build
docker compose up -d

# 5. Migration jika versi baru ada perubahan skema
docker compose exec opr-app npm run migrate

# 6. Health check + functional test (Bahagian 14-15)
```

`docker compose up -d` menggantikan container `opr-app` sahaja — downtime minimum (~beberapa saat). `opr-postgres` tidak terjejas.

> ⚠️ **JANGAN** jalankan `docker compose down -v` (memadam volume) atau `rm -rf /data/opr` semasa update biasa.

## 25. Rollback

Simpan setiap ZIP release (`opr-system-production-2026-08-27.zip`, dsb.) sebagai arkib. Untuk rollback:

```bash
mkdir -p ~/apps/opr-system-rollback
cd ~/apps/opr-system-rollback
unzip ~/uploads/opr-system-production-VERSI-SEBELUMNYA.zip
cp ~/apps/opr-system/.env .env   # guna .env production SAMA

docker compose build
docker compose up -d
```

Kerana `container_name` ditetapkan eksplisit (`opr-app`, `opr-postgres`) dalam `docker-compose.yml`, menjalankan `docker compose up -d` daripada direktori BERBEZA tetap menggantikan container yang SAMA dengan betul (bukan mencipta stack berasingan/konflik). `/data/opr/postgres` dan `/data/opr/pdfs` tidak disentuh.

> Jika versi yang di-rollback-kan mempunyai migration yang **backward-incompatible** (jarang berlaku, tetapi mungkin pada masa depan), rollback source sahaja tidak mencukupi — skema DB mungkin sudah berubah. Semak `_migrations` table sebelum rollback jika situasi ini timbul.

## 26. Logs

```bash
docker compose ps
docker compose logs -f opr-app
docker compose logs -f opr-postgres
```

## 27. Restart

```bash
docker compose restart opr-app     # satu servis
docker compose restart             # kedua-dua servis
```

Data persistent tidak terjejas oleh restart.

## 28. Storage Monitoring

```bash
du -sh /data/opr/pdfs      # saiz arkib PDF
df -h                       # ruang cakera keseluruhan
```

PDF **tiada expiry/auto-delete** — pantau ruang cakera dari semasa ke semasa (cadangan: semak bulanan).

## 29. Troubleshooting

| Isu | Semakan |
|---|---|
| `opr-app` tidak start | `docker compose logs opr-app` — biasanya `.env` tidak lengkap atau `DATABASE_URL` salah |
| `opr-postgres` unhealthy | `docker compose logs opr-postgres`; sahkan `/data/opr/postgres` permission (70:70, 700) |
| Database authentication gagal | `POSTGRES_PASSWORD` dan password dalam `DATABASE_URL` **mesti sama** |
| Permission `/data/opr/pdfs` | Sahkan `chown 1000:1000` + `chmod 700` (Bahagian 5) |
| Permission `/data/opr/postgres` | Sahkan `chown 70:70` + `chmod 700` |
| Chromium executable tidak ditemui | `docker compose exec opr-app which chromium-browser` (Bahagian 16); kemas kini `CHROMIUM_PATH` jika perlu |
| Puppeteer launch gagal | Semak `docker compose logs opr-app` untuk mesej `[pdf]`; sahkan RAM server mencukupi |
| PDF generation 500 | Semak log `[opr] gagal jana PDF` / `[opr] gagal proses gambar` untuk sebab tepat |
| PDF melebihi satu halaman (422) | Tingkah laku **betul** — guru perlu ringkaskan kandungan, bukan bug |
| Cloudflare 502 | **Test `curl http://127.0.0.1:3070/api/health` DAHULU** — jika localhost gagal, masalah di aplikasi bukan Cloudflare; jika localhost OK tapi 502 berterusan, semak konfigurasi ingress tunnel (Bahagian 17) |
| `opr.byzaifuan.com` tidak resolve | Semak DNS CNAME wujud dan menunjuk ke tunnel yang betul (Bahagian 18) |
| Admin secure cookie/login bermasalah | Sahkan akses melalui `https://opr.byzaifuan.com` (bukan `http://ip:3070` terus) DAN `cloudflared` menghantar header `X-Forwarded-Proto: https` (lalai standard) — lihat Bahagian 15 Test 2 untuk cara sahkan tepat |
| Disk hampir penuh | `df -h` + `du -sh /data/opr/pdfs` (Bahagian 28); tiada auto-cleanup PDF, perlu tindakan manual (storan tambahan) jika perlu |

---

## 30. GitHub — Source Repository

Repository dicadangkan: **`zaifuan/opr-system`** (**Private**).

```bash
cd ~/apps/opr-system   # atau salinan source di komputer anda
git init
git add .
git commit -m "Initial production release"
git branch -M main
git remote add origin https://github.com/zaifuan/opr-system.git
git push -u origin main
```

GitHub ialah **storan source code sahaja** — bukan mekanisme deployment. `.gitignore` sudah melindungi `.env`, `node_modules/`, hasil build, log, dan sebarang data/backup daripada ter-commit (disahkan bersih semasa Fasa 6 — lihat laporan). Deployment production kekal manual: ZIP → WinSCP → Docker build di server.
