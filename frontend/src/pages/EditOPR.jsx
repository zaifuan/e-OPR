import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import BuatOPR from './BuatOPR';
import VersionHistory from '../components/VersionHistory';
import { MIN_SESSIONS } from './opr-form.constants';
import { computeServerOffset, getEditEntry, removeEditToken, saveEditToken } from '../utils/editTokens';

// Kemas Kini 2: halaman Edit OPR (/opr/:id/edit).
// Kebenaran: token suntingan pelayar ini (localStorage), Pautan Edit
// (#t=<token> - dibaca sekali, disimpan, kemudian dibuang daripada URL), atau
// sesi Admin. Backend menentukan kebenaran & tempoh; halaman ini memaparkan
// keputusannya sahaja.

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

// Ambil token daripada #t=... (Pautan Edit) - fragment tidak pernah dihantar
// ke server, dan dibuang daripada bar alamat selepas dibaca.
// Cache ringkas: React StrictMode (dev) memanggil pemula useState dua kali.
let hashTokenCache = null;
function takeTokenFromHash() {
  const match = /^#t=([A-Za-z0-9_-]{43})$/.exec(window.location.hash || '');
  if (!match) {
    return hashTokenCache && hashTokenCache.path === window.location.pathname ? hashTokenCache.token : null;
  }
  hashTokenCache = { path: window.location.pathname, token: match[1] };
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return match[1];
}

// id stabil (key React) bagi baris yang dipulihkan - julat berasingan
// daripada pembilang dalam BuatOPR supaya tiada pertembungan key.
let restoredId = 100000;

const FORM_KEYS = [
  'program_name',
  'organizer',
  'organizer_other',
  'date_mode',
  'time_mode',
  'program_date_start',
  'program_date_end',
  'start_time',
  'end_time',
  'location',
  'target_group',
  'objectives',
  'activity_summary',
  'strengths',
  'weaknesses',
  'improvements',
  'prepared_by',
  'verified_by',
  'prepared_by_position',
  'verified_by_position',
];

const EMPTY_FORM = {
  program_name: '',
  organizer: '',
  organizer_other: '',
  date_mode: 'range',
  time_mode: 'same',
  program_date_start: '',
  program_date_end: '',
  start_time: '',
  end_time: '',
  location: '',
  target_group: '',
  objectives: '',
  activity_summary: '',
  strengths: '',
  weaknesses: '',
  improvements: '',
  prepared_by: '',
  verified_by: '',
  prepared_by_position: '',
  verified_by_position: '',
};

// Snapshot (opr_versions.form_data) -> keadaan awal borang BuatOPR.
// Baris baru CRLF (format multipart) dinormalkan ke LF seperti textarea.
function buildEditContext({ id, token, data }) {
  const snap = data.form || {};
  const text = (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n') : '');
  const initialForm = { ...EMPTY_FORM };
  for (const key of FORM_KEYS) {
    if (typeof snap[key] === 'string') initialForm[key] = text(snap[key]);
  }
  if (initialForm.date_mode !== 'separate') initialForm.date_mode = 'range';
  if (initialForm.time_mode !== 'different') initialForm.time_mode = 'same';

  let initialSessions = Array.isArray(snap.sessions)
    ? snap.sessions.map((s) => ({
        id: restoredId++,
        date: text(s && s.date),
        start_time: text(s && s.start_time),
        end_time: text(s && s.end_time),
      }))
    : [];
  while (initialSessions.length < MIN_SESSIONS) {
    initialSessions = [...initialSessions, { id: restoredId++, date: '', start_time: '', end_time: '' }];
  }

  const initialInfo = Array.isArray(snap.additional_info)
    ? snap.additional_info.map((info) => ({ id: restoredId++, title: text(info && info.title), content: text(info && info.content) }))
    : [];

  const images = Array.isArray(data.images) ? data.images : null;
  return {
    id,
    token,
    currentVersion: data.current_version,
    designId: data.design_id || 'original', // Kemas Kini 5
    expiresAt: data.edit_expires_at,
    serverOffsetMs: computeServerOffset(data.server_time),
    initialForm,
    initialSessions,
    initialInfo,
    initialImages: images ? images.map((previewUrl, existingIndex) => ({ existingIndex, previewUrl })) : [],
    imagesUnavailable: !images,
  };
}

export default function EditOPR() {
  const { id } = useParams();
  const validId = /^[1-9]\d{0,9}$/.test(String(id || ''));
  // Token dibaca sekali semasa mount (Pautan Edit didahulukan, kemudian pelayar ini).
  const [token] = useState(() => {
    const fromHash = takeTokenFromHash();
    if (fromHash) return fromHash;
    const entry = validId ? getEditEntry(id) : null;
    return entry && TOKEN_RE.test(entry.token) ? entry.token : null;
  });
  const [state, setState] = useState(() => (validId ? { status: 'loading' } : { status: 'error', code: 'not_found', message: 'Rekod OPR tidak ditemui.' }));

  useEffect(() => {
    if (!validId) return undefined;
    let active = true;
    api
      .getOprEditData(id, token)
      .then((data) => {
        if (!active) return;
        if (token) {
          // Pautan Edit dari peranti lain: simpan supaya butang Edit tersedia
          // di pelayar ini sepanjang baki tempoh.
          saveEditToken(id, { token, expiresAt: data.edit_expires_at, serverOffsetMs: computeServerOffset(data.server_time) });
        }
        setState({ status: 'ready', context: buildEditContext({ id: Number(id), token, data }) });
      })
      .catch((err) => {
        if (!active) return;
        if (token && err.code === 'forbidden') removeEditToken(id); // token tidak sah untuk OPR ini
        setState({ status: 'error', code: err.code || (err.status === 404 ? 'not_found' : 'error'), message: err.message });
      });
    return () => {
      active = false;
    };
  }, [id, token, validId]);

  if (state.status === 'loading') {
    return (
      <div className="page">
        <h1>Edit OPR</h1>
        <div className="opr-viewer-message" role="status" aria-live="polite">
          <span className="opr-viewer-spinner" aria-hidden="true" />
          <p>Memuatkan borang Edit...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page page-narrow">
        <h1>Edit OPR</h1>
        <div className="opr-viewer-message opr-viewer-error" role="alert">
          <p>{state.message}</p>
          {state.code === 'forbidden' && (
            <p className="text-muted">
              Edit hanya boleh dibuat daripada pelayar yang menjana OPR, melalui Pautan Edit yang diberikan selepas OPR
              dijana, atau oleh Admin.
            </p>
          )}
          <div className="opr-viewer-message-actions">
            {state.code !== 'not_found' && (
              <Link className="btn btn-primary" to={`/opr/${id}/lihat`}>
                Lihat OPR
              </Link>
            )}
            <Link className="btn btn-secondary" to="/rekod">
              Ke Rekod OPR
            </Link>
          </div>
        </div>
        {state.code === 'locked' && <VersionHistory id={id} token={token} hideWhenSingle />}
      </div>
    );
  }

  return (
    <>
      <BuatOPR editContext={state.context} />
      <div className="page">
        <VersionHistory id={id} token={token} />
      </div>
    </>
  );
}
