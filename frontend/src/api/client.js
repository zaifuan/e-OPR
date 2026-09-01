const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // respons tanpa body (jarang berlaku pada API ini)
  }

  if (!res.ok) {
    const message = (data && data.error) || 'Ralat tidak dijangka. Sila cuba lagi.';
    throw new Error(message);
  }

  return data;
}

// Untuk multipart/form-data (upload gambar) - JANGAN set Content-Type secara
// manual, browser perlu jana boundary sendiri berdasarkan objek FormData.
async function requestForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // respons tanpa body
  }

  if (!res.ok) {
    const message = (data && data.error) || 'Ralat tidak dijangka. Sila cuba lagi.';
    const err = new Error(message);
    if (data && data.errors) {
      err.fieldErrors = data.errors;
    }
    throw err;
  }

  return data;
}

// POST /api/opr (Fasa 4): kejayaan kini JSON {success, record} - PDF disimpan
// kekal di server, dilihat/dimuat-turun melalui GET /api/opr/:id/pdf secara
// berasingan (bukan blob daripada respons POST ini lagi).
async function submitOprForm(formData) {
  const res = await fetch(`${BASE}/opr`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // tiada body
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || 'Ralat tidak dijangka. Sila cuba lagi.';
    const err = new Error(message);
    if (data && data.errors) {
      err.fieldErrors = data.errors;
    }
    throw err;
  }

  return data.record;
}

async function recentOpr(signal) {
  const res = await fetch(`${BASE}/opr/recent`, { credentials: 'include', signal });
  if (!res.ok) throw new Error('Ralat memuatkan rekod OPR.');
  return res.json();
}

// year/organizer optional ('' atau undefined = "Semua", tiada filter).
async function searchOpr({ q = '', year = '', organizer = '', page = 1 } = {}, signal) {
  const params = new URLSearchParams({ q, page: String(page) });
  if (year) params.set('year', String(year));
  if (organizer) params.set('organizer', organizer);
  const res = await fetch(`${BASE}/opr/search?${params}`, { credentials: 'include', signal });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || 'Ralat mencari rekod OPR.');
  }
  return res.json();
}

// Senarai tahun sebenar dalam DB - sumber pilihan dropdown Tahun.
async function getOprYears() {
  const res = await fetch(`${BASE}/opr/years`, { credentials: 'include' });
  if (!res.ok) throw new Error('Ralat memuatkan senarai tahun.');
  return res.json();
}

async function getOprById(id) {
  const res = await fetch(`${BASE}/opr/${id}`, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error) || 'Rekod OPR tidak ditemui.');
  }
  return res.json();
}

async function deleteOpr(id) {
  const res = await fetch(`${BASE}/admin/opr/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || 'OPR gagal dipadam. Sila cuba semula.');
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: (path, formData) => requestForm(path, formData),
  submitOprForm,
  recentOpr,
  searchOpr,
  getOprYears,
  getOprById,
  deleteOpr,
};
