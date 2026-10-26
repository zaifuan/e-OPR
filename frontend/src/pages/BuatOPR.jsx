import { useState } from 'react';
import Field from '../components/Field';
import { api } from '../api/client';
import {
  LIMITS,
  REQUIRED_IMAGES,
  MAX_IMAGE_MB,
  ALLOWED_IMAGE_TYPES,
  ORGANIZER_OPTIONS,
  OTHER_ORGANIZER,
  MIN_SESSIONS,
  MAX_SESSIONS,
  MAX_ADDITIONAL_INFO,
  ADDITIONAL_INFO_TITLE_MAX,
  ADDITIONAL_INFO_CONTENT_MAX,
  kiraHariJulat,
} from './opr-form.constants';

// Pembaharuan 02: setiap baris tarikh berasingan ada id stabil (key React)
// supaya input kekal betul walaupun baris disusun semula/dibuang.
let nextSessionId = 1;
function newSession() {
  return { id: nextSessionId++, date: '', start_time: '', end_time: '' };
}
function initialSessions() {
  return Array.from({ length: MIN_SESSIONS }, newSession);
}

// Pembaharuan 03: LAIN-LAIN (NYATAKAN) - setiap set maklumat tambahan ada id
// stabil (key React) supaya input kekal betul apabila set dibuang.
let nextInfoId = 1;
function newInfo() {
  return { id: nextInfoId++, title: '', content: '' };
}
const INFO_TITLE_EXAMPLES = ['IMPAK', 'TINDAKAN SUSULAN', 'CADANGAN'];

// Susun automatik: tarikh terisi paling awal -> paling lewat, baris kosong
// di hujung. Masa sentiasa bergerak bersama tarikhnya (satu objek sesi).
function sortSessions(list) {
  return [...list].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}

const INITIAL_FORM = {
  program_name: '',
  organizer: '',
  organizer_other: '', // Nama Anjuran manual - hanya digunakan apabila LAIN-LAIN dipilih
  date_mode: 'range', // 'range' = Tarikh Berturut-turut (asal) | 'separate' = Tarikh Berasingan
  time_mode: 'same', // mod berasingan sahaja: 'same' = Masa Sama | 'different' = Masa Berbeza
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
  prepared_by_position: '', // Pembaharuan 04: Jawatan (tidak wajib, kosong secara lalai)
  verified_by_position: '',
};

// Validasi client-side - cermin tepat peraturan backend (src/services/opr.validation.js)
// supaya guru dapat maklum balas segera tanpa perlu tunggu round-trip server untuk
// kesilapan asas seperti field kosong.
// Counter aksara ringkas dipaparkan pada semua field berhad (Bahagian P).
function CharCounter({ value, limit }) {
  return (
    <span className="char-counter">
      {value.length} / {limit}
    </span>
  );
}

function validateTimes(form, errors) {
  if (form.start_time.trim() === '') {
    errors.start_time = 'Sila masukkan masa mula.';
  }
  if (form.end_time.trim() === '') {
    errors.end_time = 'Sila masukkan masa tamat.';
  }
  if (!errors.start_time && !errors.end_time && form.end_time < form.start_time) {
    errors.end_time = 'Masa tamat mesti selepas atau sama dengan masa mula.';
  }
}

// Tarikh Berasingan - cermin validateSeparateSchedule (backend). Nombor
// "Tarikh N" mengikut susunan baris yang dipaparkan.
function validateSessions(form, sessions, errors) {
  if (sessions.length < MIN_SESSIONS) {
    errors.sessions = 'Sila masukkan sekurang-kurangnya 2 tarikh.';
    return;
  }
  if (sessions.length > MAX_SESSIONS) {
    errors.sessions = 'Maksimum 5 tarikh sahaja dibenarkan.';
    return;
  }
  for (let i = 0; i < sessions.length; i += 1) {
    const s = sessions[i];
    const n = i + 1;
    if (!s.date) {
      errors.sessions = `Sila pilih Tarikh ${n}.`;
      return;
    }
    if (form.time_mode === 'different') {
      if (!s.start_time || !s.end_time) {
        errors.sessions = `Sila masukkan masa mula dan masa tamat bagi Tarikh ${n}.`;
        return;
      }
      if (s.end_time < s.start_time) {
        errors.sessions = `Masa tamat bagi Tarikh ${n} mesti selepas atau sama dengan masa mula.`;
        return;
      }
    }
  }
  if (new Set(sessions.map((s) => s.date)).size !== sessions.length) {
    errors.sessions = 'Tarikh tidak boleh berulang. Setiap tarikh mesti berbeza.';
  }
}

function validateClientSide(form, images, sessions) {
  const errors = {};

  const requiredText = (key, msg) => {
    if (form[key].trim() === '') errors[key] = msg;
  };

  requiredText('program_name', 'Sila masukkan nama program.');
  if (!ORGANIZER_OPTIONS.includes(form.organizer)) {
    errors.organizer = 'Sila pilih anjuran.';
  } else if (form.organizer === OTHER_ORGANIZER) {
    const manual = form.organizer_other.trim();
    if (manual === '') {
      errors.organizer_other = 'Sila masukkan nama anjuran.';
    } else if (manual.length > LIMITS.organizer_other) {
      errors.organizer_other = 'Nama anjuran tidak boleh melebihi 100 aksara.';
    }
  }
  requiredText('location', 'Sila masukkan tempat program.');
  requiredText('target_group', 'Sila masukkan kumpulan sasaran.');
  requiredText('prepared_by', 'Sila masukkan nama disediakan oleh.');
  requiredText('verified_by', 'Sila masukkan nama disahkan oleh.');
  // Jawatan tidak wajib - hanya had aksara (selepas trim), sama seperti backend.
  if (form.prepared_by_position.trim().length > LIMITS.prepared_by_position) {
    errors.prepared_by_position = 'Jawatan (Disediakan Oleh) tidak boleh melebihi 80 aksara.';
  }
  if (form.verified_by_position.trim().length > LIMITS.verified_by_position) {
    errors.verified_by_position = 'Jawatan (Disahkan Oleh) tidak boleh melebihi 80 aksara.';
  }

  if (form.date_mode === 'separate') {
    validateSessions(form, sessions, errors);
    if (form.time_mode === 'same') validateTimes(form, errors);
  } else {
    if (form.program_date_start.trim() === '') {
      errors.program_date_start = 'Sila pilih tarikh mula.';
    }
    if (
      form.program_date_end.trim() !== '' &&
      form.program_date_start.trim() !== '' &&
      form.program_date_end < form.program_date_start
    ) {
      errors.program_date_end = 'Tarikh Tamat tidak boleh lebih awal daripada Tarikh Mula.';
    }
    validateTimes(form, errors);
  }

  if (images.length !== REQUIRED_IMAGES) {
    errors.images = `${REQUIRED_IMAGES} gambar dokumentasi diperlukan.`;
  }

  return errors;
}

// Cermin validateAdditionalInfo (backend). Ralat dipulangkan ikut set
// (dipaparkan di bawah set berkenaan).
function validateAdditionalInfo(infoList) {
  const errors = {};
  infoList.forEach((info, index) => {
    const n = index + 1;
    const title = info.title.trim();
    const content = info.content.trim();
    if (title === '') {
      errors[info.id] = `Sila masukkan Tajuk Maklumat bagi Maklumat ${n}.`;
    } else if (/[<>]/.test(title)) {
      errors[info.id] = `Tajuk Maklumat bagi Maklumat ${n} tidak boleh mengandungi aksara < atau >.`;
    } else if (content === '') {
      errors[info.id] = `Sila masukkan Isi Kandungan bagi Maklumat ${n}.`;
    }
  });
  return errors;
}

export default function BuatOPR() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]); // [{ file, previewUrl }] - previewUrl ialah data: URI (bukan blob:)
  const [previewFailed, setPreviewFailed] = useState(() => new Set()); // index yang gagal decode selepas load (jarang berlaku)
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState(null); // { id, program_name, program_date, prepared_by, view_url }
  const [sessions, setSessions] = useState(initialSessions); // Tarikh Berasingan (2-5)
  const [infoList, setInfoList] = useState([]); // LAIN-LAIN (NYATAKAN): 0-3 set { id, title, content }
  const [infoErrors, setInfoErrors] = useState({}); // ralat ikut id set

  const updateInfo = (id, field) => (event) => {
    const { value } = event.target;
    setInfoList((prev) => prev.map((info) => (info.id === id ? { ...info, [field]: value } : info)));
  };

  const addInfo = () => {
    setInfoList((prev) => (prev.length >= MAX_ADDITIONAL_INFO ? prev : [...prev, newInfo()]));
  };

  const removeInfo = (id) => {
    setInfoList((prev) => prev.filter((info) => info.id !== id));
    setInfoErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateSession = (id, field) => (event) => {
    const { value } = event.target;
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, [field]: value } : s));
      return field === 'date' ? sortSessions(next) : next;
    });
  };

  const addSession = () => {
    setSessions((prev) => (prev.length >= MAX_SESSIONS ? prev : [...prev, newSession()]));
  };

  const removeSession = (id) => {
    setSessions((prev) => (prev.length <= MIN_SESSIONS ? prev : prev.filter((s) => s.id !== id)));
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  // Baca fail sebagai data: URI (bukan URL.createObjectURL/"blob:") - CSP
  // sistem (helmet default: img-src 'self' data:) menyekat skema blob:
  // sepenuhnya, menyebabkan <img> gagal muat walaupun File sah dalam state
  // (punca sebenar isu preview rosak). data: URI sudah dibenarkan CSP sedia
  // ada tanpa perlu ubah backend langsung.
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Gagal membaca fail.'));
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = ''; // benarkan pilih fail sama semula selepas dibuang

    const room = REQUIRED_IMAGES - images.length;
    const toRead = [];
    let imageError;

    for (const file of selected) {
      if (toRead.length >= room) {
        imageError = `${REQUIRED_IMAGES} gambar dokumentasi diperlukan.`;
        break;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        imageError = 'Format gambar tidak disokong.';
        continue;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        imageError = 'Saiz setiap gambar mestilah tidak melebihi 10 MB.';
        continue;
      }
      toRead.push(file);
    }

    if (toRead.length > 0) {
      const results = await Promise.all(
        toRead.map(async (file) => {
          try {
            return { file, previewUrl: await readAsDataUrl(file) };
          } catch {
            // Fail sah mengikut validation tetapi gagal dibaca pelayar -
            // tetap terima (backend validation kekal muktamad), preview
            // sahaja akan guna fallback "Preview tidak tersedia".
            return { file, previewUrl: null };
          }
        })
      );
      setImages((prev) => [...prev, ...results]);
    }
    setErrors((prev) => ({ ...prev, images: imageError }));
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setPreviewFailed((prev) => {
      const next = new Set();
      // Anjak index yang > index dibuang supaya kekal sepadan gambar baki
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  // Borang HANYA di-reset apabila guru tekan "Buat OPR Baru" secara eksplisit -
  // bukan automatik selepas kejayaan (Bahagian 12 spesifikasi Fasa 4).
  const resetForm = () => {
    setForm(INITIAL_FORM);
    setImages([]);
    setPreviewFailed(new Set());
    setErrors({});
    setRecord(null);
    setSessions(initialSessions());
    setInfoList([]);
    setInfoErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateClientSide(form, images, sessions);
    const clientInfoErrors = validateAdditionalInfo(infoList);
    if (Object.keys(clientErrors).length > 0 || Object.keys(clientInfoErrors).length > 0) {
      setErrors(clientErrors);
      setInfoErrors(clientInfoErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setInfoErrors({});

    try {
      const formData = new FormData();
      // Pembaharuan 02: hanya medan milik jenis tarikh/masa SEMASA dihantar -
      // nilai tersembunyi daripada mod lain tidak pernah sampai ke backend/PDF.
      const separate = form.date_mode === 'separate';
      const skip = new Set(['time_mode']);
      if (separate) {
        skip.add('program_date_start');
        skip.add('program_date_end');
        if (form.time_mode === 'different') {
          skip.add('start_time');
          skip.add('end_time');
        }
      }
      Object.entries(form).forEach(([key, value]) => {
        // Nama anjuran manual hanya dihantar jika LAIN-LAIN dipilih - jika guru
        // kembali ke anjuran asal, nilai manual yang tersembunyi tidak digunakan.
        if (key === 'organizer_other' && form.organizer !== OTHER_ORGANIZER) return;
        if (skip.has(key)) return;
        formData.append(key, value);
      });
      if (separate) {
        formData.append('time_mode', form.time_mode);
        const payload = sortSessions(sessions).map((s) =>
          form.time_mode === 'different'
            ? { date: s.date, start_time: s.start_time, end_time: s.end_time }
            : { date: s.date }
        );
        formData.append('sessions', JSON.stringify(payload));
      }
      // LAIN-LAIN (NYATAKAN): dihantar hanya jika ada set; susunan ikut borang.
      if (infoList.length > 0) {
        formData.append(
          'additional_info',
          JSON.stringify(infoList.map((info) => ({ title: info.title, content: info.content })))
        );
      }
      images.forEach(({ file }) => formData.append('images', file));

      const savedRecord = await api.submitOprForm(formData);
      setRecord(savedRecord);
    } catch (err) {
      setErrors(err.fieldErrors || { _global: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (record) {
    return (
      <div className="page page-narrow">
        <h1>Buat OPR</h1>
        <div className="success-panel">
          <p>OPR berjaya dijana dan disimpan.</p>
        </div>

        <div className="result-actions">
          <a className="btn btn-primary" href={record.view_url} target="_blank" rel="noreferrer">
            Lihat OPR
          </a>
          <a className="btn btn-secondary" href={`${record.view_url}?download=1`}>
            Muat Turun PDF
          </a>
          <button type="button" className="btn btn-secondary" onClick={resetForm}>
            Buat OPR Baru
          </button>
        </div>
      </div>
    );
  }

  const hariPratonton = kiraHariJulat(form.program_date_start, form.program_date_end);

  return (
    <div className="page">
      <h1>Buat OPR</h1>

      {errors._global && <p className="form-error form-error-banner">{errors._global}</p>}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <Field label="Nama Program" error={errors.program_name}>
          <input
            type="text"
            value={form.program_name}
            onChange={handleChange('program_name')}
            maxLength={LIMITS.program_name}
          />
          <CharCounter value={form.program_name} limit={LIMITS.program_name} />
        </Field>

        <Field label="Anjuran" error={errors.organizer}>
          <select value={form.organizer} onChange={handleChange('organizer')} required>
            <option value="" disabled>
              Pilih Anjuran
            </option>
            {ORGANIZER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        {form.organizer === OTHER_ORGANIZER && (
          <Field label="Nama Anjuran" error={errors.organizer_other}>
            <input
              type="text"
              value={form.organizer_other}
              onChange={handleChange('organizer_other')}
              maxLength={LIMITS.organizer_other}
              placeholder="Contoh: Panitia Bahasa Arab"
            />
            <CharCounter value={form.organizer_other} limit={LIMITS.organizer_other} />
          </Field>
        )}

        <Field label="Jenis Tarikh" error={errors.date_mode}>
          <select value={form.date_mode} onChange={handleChange('date_mode')}>
            <option value="range">Tarikh Berturut-turut</option>
            <option value="separate">Tarikh Berasingan</option>
          </select>
        </Field>

        {form.date_mode === 'separate' && (
          <>
            <Field label="Masa" error={errors.time_mode}>
              <select value={form.time_mode} onChange={handleChange('time_mode')}>
                <option value="same">Masa Sama untuk Semua Tarikh</option>
                <option value="different">Masa Berbeza Mengikut Tarikh</option>
              </select>
            </Field>

            <div className="field">
              <span>Tarikh Program</span>
              <span className="field-hint">
                {MIN_SESSIONS} hingga {MAX_SESSIONS} tarikh. Tarikh disusun secara automatik daripada paling awal.
              </span>
              <div className="session-list">
                {sessions.map((s, index) => (
                  <div className="session-row" key={s.id}>
                    <Field label={`Tarikh ${index + 1}`}>
                      <input type="date" value={s.date} onChange={updateSession(s.id, 'date')} />
                    </Field>
                    {form.time_mode === 'different' && (
                      <>
                        <Field label="Masa Mula">
                          <input type="time" value={s.start_time} onChange={updateSession(s.id, 'start_time')} />
                        </Field>
                        <Field label="Masa Tamat">
                          <input type="time" value={s.end_time} onChange={updateSession(s.id, 'end_time')} />
                        </Field>
                      </>
                    )}
                    {sessions.length > MIN_SESSIONS && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small session-remove"
                        onClick={() => removeSession(s.id)}
                        aria-label={`Buang Tarikh ${index + 1}`}
                      >
                        Buang
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {errors.sessions && <span className="form-error">{errors.sessions}</span>}
              <button
                type="button"
                className="btn btn-secondary btn-small session-add"
                onClick={addSession}
                disabled={sessions.length >= MAX_SESSIONS}
              >
                + Tambah Tarikh
              </button>
            </div>

            {form.time_mode === 'same' && (
              <div className="field-row">
                <Field label="Masa Mula" error={errors.start_time}>
                  <input type="time" value={form.start_time} onChange={handleChange('start_time')} />
                </Field>
                <Field label="Masa Tamat" error={errors.end_time}>
                  <input type="time" value={form.end_time} onChange={handleChange('end_time')} />
                </Field>
              </div>
            )}
          </>
        )}

        {form.date_mode === 'range' && (
          <>
            <div className="field-row">
              <Field label="Tarikh Mula" error={errors.program_date_start}>
                <input
                  type="date"
                  value={form.program_date_start}
                  onChange={handleChange('program_date_start')}
                />
              </Field>
              <Field label="Tarikh Tamat" error={errors.program_date_end}>
                <input type="date" value={form.program_date_end} onChange={handleChange('program_date_end')} />
                <span className="field-hint">Biarkan kosong jika program berlangsung satu hari sahaja.</span>
              </Field>
            </div>
            {hariPratonton && <span className="field-hint">Hari: {hariPratonton}</span>}

            <div className="field-row">
              <Field label="Masa Mula" error={errors.start_time}>
                <input type="time" value={form.start_time} onChange={handleChange('start_time')} />
              </Field>
              <Field label="Masa Tamat" error={errors.end_time}>
                <input type="time" value={form.end_time} onChange={handleChange('end_time')} />
              </Field>
            </div>
          </>
        )}

        <div className="field-row">
          <Field label="Tempat" error={errors.location}>
            <input type="text" value={form.location} onChange={handleChange('location')} maxLength={LIMITS.location} />
            <CharCounter value={form.location} limit={LIMITS.location} />
          </Field>
          <Field label="Kumpulan Sasaran/Penglibatan" error={errors.target_group}>
            <input
              type="text"
              value={form.target_group}
              onChange={handleChange('target_group')}
              maxLength={LIMITS.target_group}
              placeholder="cth. Semua murid Tingkatan 4 (85 orang)"
            />
            <CharCounter value={form.target_group} limit={LIMITS.target_group} />
          </Field>
        </div>

        <Field
          label={
            <>
              Objektif / Matlamat <span className="field-hint">(Optional)</span>
            </>
          }
          error={errors.objectives}
        >
          <textarea
            rows={3}
            value={form.objectives}
            onChange={handleChange('objectives')}
            maxLength={LIMITS.objectives}
          />
          <CharCounter value={form.objectives} limit={LIMITS.objectives} />
        </Field>

        <Field
          label={
            <>
              Ringkasan Aktiviti <span className="field-hint">(Optional)</span>
            </>
          }
          error={errors.activity_summary}
        >
          <textarea
            rows={4}
            value={form.activity_summary}
            onChange={handleChange('activity_summary')}
            maxLength={LIMITS.activity_summary}
          />
          <CharCounter value={form.activity_summary} limit={LIMITS.activity_summary} />
        </Field>

        <Field
          label={
            <>
              Kekuatan <span className="field-hint">(Optional)</span>
            </>
          }
          error={errors.strengths}
        >
          <textarea
            rows={3}
            value={form.strengths}
            onChange={handleChange('strengths')}
            maxLength={LIMITS.strengths}
          />
          <CharCounter value={form.strengths} limit={LIMITS.strengths} />
        </Field>

        <Field
          label={
            <>
              Kelemahan <span className="field-hint">(Optional)</span>
            </>
          }
          error={errors.weaknesses}
        >
          <textarea
            rows={3}
            value={form.weaknesses}
            onChange={handleChange('weaknesses')}
            maxLength={LIMITS.weaknesses}
          />
          <CharCounter value={form.weaknesses} limit={LIMITS.weaknesses} />
        </Field>

        <Field
          label={
            <>
              Penambahbaikan <span className="field-hint">(Optional)</span>
            </>
          }
          error={errors.improvements}
        >
          <textarea
            rows={3}
            value={form.improvements}
            onChange={handleChange('improvements')}
            maxLength={LIMITS.improvements}
          />
          <CharCounter value={form.improvements} limit={LIMITS.improvements} />
        </Field>

        {/* Pembaharuan 03: satu bahagian induk; setiap set ialah anaknya. */}
        <div className="field">
          <span>
            Lain-lain (Nyatakan) <span className="field-hint">(Optional)</span>
          </span>
          <span className="field-hint">
            Tambah maklumat yang tiada dalam medan laporan di atas, cth. Impak atau Tindakan Susulan. Maksimum{' '}
            {MAX_ADDITIONAL_INFO} maklumat.
          </span>
          {infoList.length > 0 && (
            <div className="session-list">
              {infoList.map((info, index) => (
                <div className="info-row" key={info.id}>
                  <div className="info-row-head">
                    <strong>Maklumat {index + 1}</strong>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => removeInfo(info.id)}
                      aria-label={`Buang Maklumat ${index + 1}`}
                    >
                      Buang
                    </button>
                  </div>
                  <Field label="Tajuk Maklumat">
                    <input
                      type="text"
                      value={info.title}
                      onChange={updateInfo(info.id, 'title')}
                      maxLength={ADDITIONAL_INFO_TITLE_MAX}
                      placeholder={`Contoh: ${INFO_TITLE_EXAMPLES[index] || 'CADANGAN'}`}
                    />
                    <CharCounter value={info.title} limit={ADDITIONAL_INFO_TITLE_MAX} />
                  </Field>
                  <Field label="Isi Kandungan">
                    <textarea
                      rows={3}
                      value={info.content}
                      onChange={updateInfo(info.id, 'content')}
                      maxLength={ADDITIONAL_INFO_CONTENT_MAX}
                    />
                    <CharCounter value={info.content} limit={ADDITIONAL_INFO_CONTENT_MAX} />
                  </Field>
                  {infoErrors[info.id] && <span className="form-error">{infoErrors[info.id]}</span>}
                </div>
              ))}
            </div>
          )}
          {errors.additional_info && <span className="form-error">{errors.additional_info}</span>}
          <button
            type="button"
            className="btn btn-secondary btn-small session-add"
            onClick={addInfo}
            disabled={infoList.length >= MAX_ADDITIONAL_INFO}
          >
            + Tambah Maklumat
          </button>
        </div>

        <div className="field">
          <span>Dokumentasi Program</span>
          <span className="field-hint">4 gambar dokumentasi diperlukan.</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            disabled={images.length >= REQUIRED_IMAGES}
          />
          {errors.images && <span className="form-error">{errors.images}</span>}

          {images.length > 0 && (
            <>
              <div className="thumbnail-grid">
                {images.map((img, index) => (
                  <div className="thumbnail" key={index}>
                    {img.previewUrl && !previewFailed.has(index) ? (
                      <img
                        src={img.previewUrl}
                        alt={`Dokumentasi ${index + 1}`}
                        onError={() => setPreviewFailed((prev) => new Set(prev).add(index))}
                      />
                    ) : (
                      <div className="thumbnail-fallback">Preview tidak tersedia</div>
                    )}
                    <button type="button" onClick={() => removeImage(index)}>
                      Buang
                    </button>
                  </div>
                ))}
              </div>
              <span className="image-count">
                {images.length} daripada {REQUIRED_IMAGES} gambar dipilih
              </span>
            </>
          )}
        </div>

        <Field label="Disediakan Oleh" error={errors.prepared_by}>
          <input
            type="text"
            value={form.prepared_by}
            onChange={handleChange('prepared_by')}
            maxLength={LIMITS.prepared_by}
          />
          <CharCounter value={form.prepared_by} limit={LIMITS.prepared_by} />
        </Field>

        <Field label="Jawatan" error={errors.prepared_by_position}>
          <input
            type="text"
            value={form.prepared_by_position}
            onChange={handleChange('prepared_by_position')}
            maxLength={LIMITS.prepared_by_position}
          />
          <CharCounter value={form.prepared_by_position} limit={LIMITS.prepared_by_position} />
        </Field>

        <Field label="Disahkan Oleh" error={errors.verified_by}>
          <input
            type="text"
            value={form.verified_by}
            onChange={handleChange('verified_by')}
            maxLength={LIMITS.verified_by}
          />
          <CharCounter value={form.verified_by} limit={LIMITS.verified_by} />
        </Field>

        <Field label="Jawatan" error={errors.verified_by_position}>
          <input
            type="text"
            value={form.verified_by_position}
            onChange={handleChange('verified_by_position')}
            maxLength={LIMITS.verified_by_position}
          />
          <CharCounter value={form.verified_by_position} limit={LIMITS.verified_by_position} />
        </Field>

        {/* Ralat umum (cth. OPR melebihi satu halaman) turut dipapar dekat butang
            supaya guru nampak tanpa perlu skrol ke atas. */}
        {errors._global && <p className="form-error">{errors._global}</p>}

        <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
          {submitting ? 'Sedang menjana OPR...' : 'Jana OPR'}
        </button>
      </form>
    </div>
  );
}
