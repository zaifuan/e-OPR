import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PdfPageCanvas from '../components/PdfPageCanvas';
import { useElementWidth } from '../hooks/useElementWidth';
import { PdfLoadError, loadPdfDocument } from '../utils/pdfDocument';

// Kemas Kini 1: halaman Pratonton OPR (/opr/:id/lihat). PDF diambil daripada
// endpoint SEDIA ADA GET /api/opr/:id/pdf dan dilukis oleh PDF.js - tidak
// bergantung pada PDF viewer pelayar. Muat turun kekal melalui ?download=1.

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS.indexOf(1);

function isValidId(raw) {
  return /^[1-9]\d{0,9}$/.test(String(raw || ''));
}

export default function LihatOPR() {
  const { id, version } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Kemas Kini 2: notis selepas pembetulan disimpan (dihantar oleh borang Edit).
  const editedVersion = location.state && location.state.editedVersion;
  const [attempt, setAttempt] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [programName, setProgramName] = useState('');

  // Kemas Kini 2: /opr/:id/versi/:version/lihat -> PDF versi terdahulu
  // (endpoint khusus, Admin sahaja). Tanpa :version -> versi aktif (asal KK1).
  const validId = isValidId(id) && (version === undefined || isValidId(version));
  const pdfUrl = version ? `/api/opr/${id}/versions/${version}/pdf` : `/api/opr/${id}/pdf`;
  const downloadUrl = `${pdfUrl}?download=1`;

  // Nama program sebagai konteks sahaja - kegagalan di sini tidak menjejaskan
  // paparan PDF (ralat PDF dikendalikan berasingan oleh panel di bawah).
  useEffect(() => {
    if (!validId) return undefined;
    let active = true;
    api
      .getOprById(id)
      .then((record) => {
        if (active) setProgramName(record.program_name || '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, validId]);

  const handleBack = () => {
    // Dibuka dalam tab sama (ada sejarah dalam aplikasi) -> kembali ke halaman
    // asal; dibuka dalam tab baharu / pautan terus -> ke Rekod OPR.
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/rekod');
    }
  };

  const zoom = ZOOM_LEVELS[zoomIndex];

  return (
    <div className="page opr-viewer-page">
      <h1>Pratonton OPR</h1>
      {programName && (
        <p className="opr-viewer-subtitle">
          {programName}
          {version ? ` · Versi ${version} (arkib)` : ''}
        </p>
      )}
      {editedVersion && !version && (
        <p className="success-inline" role="status">
          Pembetulan berjaya disimpan. Memaparkan PDF Versi {editedVersion} (terkini).
        </p>
      )}

      <div className="opr-viewer-toolbar">
        <button type="button" className="btn btn-secondary btn-small" onClick={handleBack}>
          Kembali
        </button>

        <div className="opr-viewer-zoom" role="group" aria-label="Kawalan zum">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zum keluar"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small opr-viewer-zoom-value"
            onClick={() => setZoomIndex(DEFAULT_ZOOM_INDEX)}
            title="Muat lebar skrin"
            aria-label={`Zum ${Math.round(zoom * 100)}%. Tekan untuk muat lebar skrin.`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Zum masuk"
          >
            +
          </button>
        </div>

        {validId && (
          <a className="btn btn-primary btn-small" href={downloadUrl}>
            Muat Turun PDF
          </a>
        )}
      </div>

      {validId ? (
        <OprPdfPane
          key={`${pdfUrl}-${attempt}`}
          pdfUrl={pdfUrl}
          downloadUrl={downloadUrl}
          zoom={zoom}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <div className="opr-viewer-message opr-viewer-error" role="alert">
          <p>OPR tidak ditemui. Pautan mungkin tidak sah.</p>
          <div className="opr-viewer-message-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/rekod')}>
              Ke Rekod OPR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Dipasang semula (key) setiap kali "Cuba Semula" ditekan - keadaan bermula
// bersih tanpa sisa dokumen/worker lama.
function OprPdfPane({ pdfUrl, downloadUrl, zoom, onRetry }) {
  const stageRef = useRef(null);
  // Lebar ruang PDF = lebar bekas tolak padding .opr-viewer-stage (2 x 8px).
  const width = Math.max(useElementWidth(stageRef) - 16, 0);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let loaded = null;

    loadPdfDocument(pdfUrl, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          result.destroy();
          return;
        }
        loaded = result;
        setDoc(result.doc);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof PdfLoadError ? err : new PdfLoadError('render'));
      });

    return () => {
      controller.abort();
      if (loaded) loaded.destroy();
    };
  }, [pdfUrl]);

  const handleRenderError = useCallback(() => {
    setError(new PdfLoadError('render'));
  }, []);

  if (error) {
    const viewerFailed = error.kind === 'invalid' || error.kind === 'render';
    return (
      <div className="opr-viewer-message opr-viewer-error" role="alert">
        <p>{error.message}</p>
        <div className="opr-viewer-message-actions">
          {error.kind !== 'not_found' && error.kind !== 'forbidden' && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Cuba Semula
            </button>
          )}
          {error.kind !== 'not_found' && error.kind !== 'forbidden' && (
            <a className="btn btn-secondary" href={downloadUrl}>
              Muat Turun PDF
            </a>
          )}
          {viewerFailed && (
            <a className="btn btn-secondary" href={pdfUrl} target="_blank" rel="noreferrer">
              Buka PDF Terus
            </a>
          )}
        </div>
      </div>
    );
  }

  const pageNumbers = doc ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : [];

  return (
    <div className="opr-viewer-stage" ref={stageRef}>
      {!doc && (
        <div className="opr-viewer-message" role="status" aria-live="polite">
          <span className="opr-viewer-spinner" aria-hidden="true" />
          <p>Memuatkan PDF...</p>
        </div>
      )}
      {doc &&
        pageNumbers.map((n) => (
          <PdfPageCanvas
            key={n}
            doc={doc}
            pageNumber={n}
            width={width}
            zoom={zoom}
            onRenderError={handleRenderError}
          />
        ))}
    </div>
  );
}
