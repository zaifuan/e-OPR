import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ticketFromSource } from '../utils/duplicateTicket';
import BuatOPR from './BuatOPR';
import { MIN_SESSIONS, MAX_SESSIONS, formatTarikhMelayu } from './opr-form.constants';

// Kemas Kini 3: halaman Duplicate & Edit (/opr/:id/duplicate).
// Membaca data sumber (baca sahaja) lalu membuka borang BuatOPR dalam mod
// Duplicate. TIADA rekod dicipta dengan membuka halaman ini - rekod baharu
// hanya wujud selepas guru menekan "Jana OPR Baharu" (POST /api/opr asal).

let restoredId = 200000; // julat key React berasingan daripada BuatOPR/EditOPR

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

const text = (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n') : '');

function masa(start, end) {
  return start && end ? `${start}–${end}` : start || '';
}

// Rujukan tarikh/masa asal dalam bentuk ayat (paparan sahaja).
function describeReference(ref) {
  if (!ref) return '';
  if (ref.mode === 'separate') {
    return (ref.sessions || [])
      .map((s) => [formatTarikhMelayu(s.date), masa(s.start_time, s.end_time)].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('; ');
  }
  const tarikh = ref.start_date
    ? ref.end_date && ref.end_date !== ref.start_date
      ? `${formatTarikhMelayu(ref.start_date)} – ${formatTarikhMelayu(ref.end_date)}`
      : formatTarikhMelayu(ref.start_date)
    : '';
  return [tarikh, masa(ref.start_time, ref.end_time)].filter(Boolean).join(', ');
}

function buildDuplicateContext(data) {
  const src = data.form || {};
  const initialForm = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM)) {
    if (typeof src[key] === 'string') initialForm[key] = text(src[key]);
  }
  // Tarikh SENTIASA kosong - guru mesti menetapkan tarikh program baharu.
  initialForm.program_date_start = '';
  initialForm.program_date_end = '';
  if (initialForm.date_mode !== 'separate') initialForm.date_mode = 'range';
  if (initialForm.time_mode !== 'different') initialForm.time_mode = 'same';

  // Struktur tarikh berasingan dikekalkan (bilangan baris & masa), tarikh kosong.
  const srcSessions = Array.isArray(src.sessions) ? src.sessions.slice(0, MAX_SESSIONS) : [];
  const initialSessions = srcSessions.map((s) => ({
    id: restoredId++,
    date: '',
    start_time: text(s && s.start_time),
    end_time: text(s && s.end_time),
  }));
  while (initialSessions.length < MIN_SESSIONS) {
    initialSessions.push({ id: restoredId++, date: '', start_time: '', end_time: '' });
  }

  const initialInfo = Array.isArray(src.additional_info)
    ? src.additional_info.map((i) => ({ id: restoredId++, title: text(i.title), content: text(i.content) }))
    : [];

  return {
    sourceId: data.source.id,
    ticket: ticketFromSource(data),
    sourceName: data.source.program_name,
    designId: data.design_id || 'original', // Kemas Kini 5: design sumber (legacy = Original)
    isLegacy: data.kind === 'legacy',
    missingFields: Array.isArray(data.missing_fields) ? data.missing_fields : [],
    scheduleReference: describeReference(data.schedule_reference),
    initialForm,
    initialSessions,
    initialInfo,
  };
}

export default function DuplicateOPR() {
  const { id } = useParams();
  const validId = /^[1-9]\d{0,9}$/.test(String(id || ''));
  const [state, setState] = useState(() =>
    validId ? { status: 'loading' } : { status: 'error', message: 'Rekod OPR tidak ditemui.' }
  );

  useEffect(() => {
    if (!validId) return undefined;
    let active = true;
    api
      .getOprDuplicateSource(id)
      .then((data) => active && setState({ status: 'ready', context: buildDuplicateContext(data) }))
      .catch((err) => active && setState({ status: 'error', message: err.message }));
    return () => {
      active = false;
    };
  }, [id, validId]);

  if (state.status === 'loading') {
    return (
      <div className="page">
        <h1>Duplicate &amp; Edit OPR</h1>
        <div className="opr-viewer-message" role="status" aria-live="polite">
          <span className="opr-viewer-spinner" aria-hidden="true" />
          <p>Memuatkan maklumat rekod sumber...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page page-narrow">
        <h1>Duplicate &amp; Edit OPR</h1>
        <div className="opr-viewer-message opr-viewer-error" role="alert">
          <p>{state.message}</p>
          <div className="opr-viewer-message-actions">
            <Link className="btn btn-secondary" to="/rekod">
              Ke Rekod OPR
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <BuatOPR key={id} duplicateContext={state.context} />;
}
