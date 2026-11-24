// Kemas Kini 1 (Universal PDF Viewer): PDF dipaparkan sendiri melalui PDF.js
// (render canvas) - TIDAK lagi bergantung pada PDF viewer terbina dalam
// pelayar (Chrome Android / Samsung Internet sesetengah versi tiada viewer
// inline, lalu hanya menawarkan "Download").
//
// Build `legacy/` dipilih SENGAJA (bukan build moden): ia disertakan polyfill
// core-js & sintaks yang diturunkan untuk pelayar telefon yang lebih lama -
// kumpulan peranti yang paling mungkin bermasalah. Modul ini hanya dimuatkan
// oleh halaman /opr/:id/lihat (React.lazy di App.jsx), jadi saiz PDF.js tidak
// menambah beban halaman lain.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
// `?url` - Vite salin fail worker sebagai aset statik dengan hash dalam
// /assets (same-origin). Tiada CDN luaran; CSP sedia ada (worker-src jatuh
// balik ke script-src 'self') kekal tanpa dilonggarkan.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

// Muat turun PDF dihadkan supaya halaman tidak "berpusing" selama-lamanya jika
// rangkaian/Drive tergantung (backend sendiri ada timeout 20s fasa permulaan).
const FETCH_TIMEOUT_MS = 45000;

// Had saiz canvas (piksel) - iOS Safari menolak canvas melebihi ~16.7 juta
// piksel (canvas menjadi kosong). 10 juta memberi margin selamat.
export const MAX_CANVAS_PIXELS = 10_000_000;

export class PdfLoadError extends Error {
  // kind: 'not_found' | 'forbidden' | 'rate_limited' | 'server' | 'network' | 'timeout' | 'invalid' | 'render'
  constructor(kind, message) {
    super(message || MESSAGES[kind]);
    this.name = 'PdfLoadError';
    this.kind = kind;
  }
}

const MESSAGES = {
  not_found: 'OPR atau fail PDF tidak ditemui. Rekod mungkin telah dipadam.',
  forbidden: 'Anda tiada kebenaran untuk melihat versi PDF ini. Sila log masuk sebagai Admin.', // Kemas Kini 2 (versi arkib)
  rate_limited: 'Terlalu banyak permintaan. Sila tunggu sebentar dan cuba semula.',
  server: 'PDF tidak dapat dimuatkan buat masa ini. Sila cuba semula.',
  network: 'Sambungan internet bermasalah. Semak sambungan anda dan cuba semula.',
  timeout: 'Memuatkan PDF mengambil masa terlalu lama. Sila cuba semula.',
  invalid: 'PDF tidak dapat dipaparkan pada pelayar ini. Sila muat turun PDF.',
  render: 'PDF tidak dapat dipaparkan pada pelayar ini. Sila muat turun PDF.',
  cancelled: 'Dibatalkan.',
};

function isPdfHeader(bytes) {
  // Spesifikasi PDF membenarkan "%PDF-" muncul dalam 1024 bait pertama.
  const limit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

// Ambil PDF melalui endpoint backend SEDIA ADA (GET /api/opr/:id/pdf) dengan
// fetch() - satu permintaan penuh, tanpa HTTP Range (PDF OPR satu halaman,
// beberapa ratus KB; Range tidak memberi manfaat). fetch sendiri memberi
// kawalan jelas ke atas status HTTP (404/429/5xx) untuk mesej ralat tepat.
//
// Pulangkan { doc, destroy } - pemanggil WAJIB panggil destroy() semasa
// cleanup (menamatkan worker & membebaskan memori dokumen).
export async function loadPdfDocument(url, externalSignal) {
  const controller = new AbortController();
  const abortFromOutside = () => controller.abort('cancelled');
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort('cancelled');
    else externalSignal.addEventListener('abort', abortFromOutside, { once: true });
  }
  const timer = setTimeout(() => controller.abort('timeout'), FETCH_TIMEOUT_MS);

  const abortError = () => new PdfLoadError(controller.signal.reason === 'timeout' ? 'timeout' : 'cancelled');
  let loadingTask = null;
  let onAbort = null;

  try {
    let res;
    try {
      res = await fetch(url, { credentials: 'include', signal: controller.signal });
    } catch {
      throw controller.signal.aborted ? abortError() : new PdfLoadError('network');
    }

    if (res.status === 404) throw new PdfLoadError('not_found');
    if (res.status === 401 || res.status === 403) throw new PdfLoadError('forbidden');
    if (res.status === 429) throw new PdfLoadError('rate_limited');
    if (!res.ok) throw new PdfLoadError('server');

    let buffer;
    try {
      buffer = await res.arrayBuffer();
    } catch {
      throw controller.signal.aborted ? abortError() : new PdfLoadError('network');
    }

    const data = new Uint8Array(buffer);
    if (!isPdfHeader(data)) throw new PdfLoadError('invalid');

    loadingTask = getDocument({
      data,
      // Tiada fetch tambahan oleh PDF.js (wasm/cmaps/font standard) - PDF OPR
      // dijana Chromium dengan font terbenam; elak permintaan ke laluan yang
      // tidak wujud & elak keperluan 'wasm-unsafe-eval' dalam CSP.
      useWasm: false,
      // Render pada main thread (canvas biasa) - laluan paling serasi merentas
      // pelayar; tidak bergantung pada OffscreenCanvas dalam worker.
      disableWorkerRendering: true,
      verbosity: 0,
    });

    const task = loadingTask;
    onAbort = () => task.destroy();
    controller.signal.addEventListener('abort', onAbort, { once: true });

    let doc;
    try {
      doc = await task.promise;
    } catch {
      throw controller.signal.aborted ? abortError() : new PdfLoadError('invalid');
    }

    return {
      doc,
      destroy: () => {
        controller.signal.removeEventListener('abort', onAbort);
        task.destroy();
      },
    };
  } catch (err) {
    if (loadingTask) loadingTask.destroy();
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromOutside);
  }
}
