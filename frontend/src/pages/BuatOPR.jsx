import { useState } from 'react';
import Field from '../components/Field';
import { api } from '../api/client';
import {
  LIMITS,
  REQUIRED_IMAGES,
  MAX_IMAGE_MB,
  ALLOWED_IMAGE_TYPES,
  ORGANIZER_OPTIONS,
  kiraHariJulat,
} from './opr-form.constants';

const INITIAL_FORM = {
  program_name: '',
  organizer: '',
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

function validateClientSide(form, images) {
  const errors = {};

  const requiredText = (key, msg) => {
    if (form[key].trim() === '') errors[key] = msg;
  };

  requiredText('program_name', 'Sila masukkan nama program.');
  if (!ORGANIZER_OPTIONS.includes(form.organizer)) {
    errors.organizer = 'Sila pilih anjuran.';
  }
  requiredText('location', 'Sila masukkan tempat program.');
  requiredText('target_group', 'Sila masukkan kumpulan sasaran.');
  requiredText('prepared_by', 'Sila masukkan nama disediakan oleh.');
  requiredText('verified_by', 'Sila masukkan nama disahkan oleh.');

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

  if (form.start_time.trim() === '') {
    errors.start_time = 'Sila masukkan masa mula.';
  }
  if (form.end_time.trim() === '') {
    errors.end_time = 'Sila masukkan masa tamat.';
  }
  if (!errors.start_time && !errors.end_time && form.end_time < form.start_time) {
    errors.end_time = 'Masa tamat mesti selepas atau sama dengan masa mula.';
  }

  if (images.length !== REQUIRED_IMAGES) {
    errors.images = `${REQUIRED_IMAGES} gambar dokumentasi diperlukan.`;
  }

  return errors;
}

export default function BuatOPR() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]); // [{ file, previewUrl }] - previewUrl ialah data: URI (bukan blob:)
  const [previewFailed, setPreviewFailed] = useState(() => new Set()); // index yang gagal decode selepas load (jarang berlaku)
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState(null); // { id, program_name, program_date, prepared_by, view_url }

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
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateClientSide(form, images);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
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

        <div className="field-row">
          <Field label="Tempat" error={errors.location}>
            <input type="text" value={form.location} onChange={handleChange('location')} maxLength={LIMITS.location} />
            <CharCounter value={form.location} limit={LIMITS.location} />
          </Field>
          <Field label="Kumpulan Sasaran" error={errors.target_group}>
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

        <Field label="Disahkan Oleh" error={errors.verified_by}>
          <input
            type="text"
            value={form.verified_by}
            onChange={handleChange('verified_by')}
            maxLength={LIMITS.verified_by}
          />
          <CharCounter value={form.verified_by} limit={LIMITS.verified_by} />
        </Field>

        <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
          {submitting ? 'Sedang menjana OPR...' : 'Jana OPR'}
        </button>
      </form>
    </div>
  );
}
