import { useEffect, useRef } from 'react';
import { MAX_CANVAS_PIXELS } from '../utils/pdfDocument';

// Kemas Kini 1: satu halaman PDF dilukis pada <canvas> oleh PDF.js.
// Lebar asas = lebar bekas ("Muat Lebar"), didarab dengan `zoom`. Resolusi
// dalaman canvas dilebihkan (≥2x) supaya teks kekal tajam apabila pengguna
// pinch-zoom pada telefon, tetapi dihadkan MAX_CANVAS_PIXELS (had iOS).
//
// Hanya SATU render aktif pada satu masa bagi setiap canvas: permintaan baharu
// (zum/putar skrin) membatalkan render semasa, dan gelung lukis mengambil
// parameter TERKINI selepas pembatalan selesai - tiada render bertindih.
export default function PdfPageCanvas({ doc, pageNumber, width, zoom, onRenderError }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    task: null,
    pending: false,
    running: false,
    mounted: true,
    page: null,
    params: null,
    onRenderError: null,
  });

  useEffect(() => {
    stateRef.current.onRenderError = onRenderError;
  }, [onRenderError]);

  useEffect(() => {
    if (!width) return;
    const state = stateRef.current;
    state.params = { width, zoom };

    if (state.running) {
      state.pending = true;
      state.task?.cancel();
      return;
    }

    async function loop() {
      state.running = true;
      try {
        do {
          state.pending = false;
          const { width: w, zoom: z } = state.params;
          try {
            if (!state.page) state.page = await doc.getPage(pageNumber);
            const canvas = canvasRef.current;
            if (!state.mounted || !canvas) return;

            const page = state.page;
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: (w / base.width) * z });

            const dpr = window.devicePixelRatio || 1;
            const wanted = Math.min(Math.max(dpr, 1) * 2, 4);
            const areaLimit = Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height));
            const outputScale = Math.max(Math.min(wanted, areaLimit), 0.5);

            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            state.task = page.render({
              canvasContext: canvas.getContext('2d'),
              viewport,
              transform: [outputScale, 0, 0, outputScale, 0, 0],
            });
            await state.task.promise;
          } catch (err) {
            if (err?.name !== 'RenderingCancelledException' && state.mounted) {
              state.onRenderError?.(err);
              return;
            }
          } finally {
            state.task = null;
          }
        } while (state.pending && state.mounted);
      } finally {
        state.running = false;
      }
    }

    loop();
  }, [doc, pageNumber, width, zoom]);

  // Bebaskan sumber halaman & memori canvas apabila komponen dibuang.
  useEffect(() => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.pending = false;
      state.task?.cancel();
      try {
        state.page?.cleanup();
      } catch {
        // dokumen mungkin sudah dimusnahkan oleh induk - selamat diabaikan
      }
      state.page = null;
      if (canvas) {
        // Lepaskan memori canvas segera (penting pada iOS Safari).
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="pdf-canvas" role="img" aria-label={`Halaman ${pageNumber} PDF OPR`} />;
}
