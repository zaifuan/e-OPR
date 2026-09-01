import { useEffect, useState } from 'react';
import { useOprRecords } from '../hooks/useOprRecords';
import { useAdminAuth } from '../context/AdminAuthContext';
import { formatTarikhMelayu } from './opr-form.constants';
import { api } from '../api/client';
import Pagination from '../components/Pagination';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

// Sepadan tepat backend ALLOWED_ORGANIZERS (src/constants/opr.js) - Bahagian D.
const ORGANIZER_FILTER_OPTIONS = ['KURIKULUM', 'HAL EHWAL MURID', 'KOKURIKULUM'];

function tahunDaripadaTarikh(tarikh) {
  return tarikh.split('-')[0];
}

export default function RekodOPR() {
  const { admin } = useAdminAuth();
  const {
    query,
    setQuery,
    year,
    setYear,
    organizer,
    setOrganizer,
    page,
    setPage,
    records,
    total,
    totalPages,
    loading,
    error,
    afterDelete,
  } = useOprRecords();

  const [years, setYears] = useState([]);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Sumber pilihan dropdown Tahun - daripada rekod sebenar DB (Bahagian B/C),
  // dimuatkan sekali sahaja (tidak berubah sepanjang sesi melayari senarai).
  useEffect(() => {
    api
      .getOprYears()
      .then((data) => setYears(data.years))
      .catch(() => {
        // Kegagalan senyap - dropdown Tahun sekadar kosong (Semua tetap
        // berfungsi); bukan ralat kritikal untuk seluruh halaman.
      });
  }, []);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteOpr(confirmTarget.id);
      setConfirmTarget(null);
      await afterDelete();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const hasFilterActive = Boolean(query.trim() || year || organizer);
  const rangeStart = total === 0 ? 0 : (page - 1) * 10 + 1;
  const rangeEnd = Math.min(page * 10, total);

  return (
    <div className="page">
      <h1>Rekod OPR</h1>

      <div className="rekod-filters">
        <div className="rekod-filter-field">
          <label htmlFor="rekod-filter-tahun">Tahun</label>
          <select id="rekod-filter-tahun" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Semua</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="rekod-filter-field">
          <label htmlFor="rekod-filter-anjuran">Anjuran</label>
          <select id="rekod-filter-anjuran" value={organizer} onChange={(e) => setOrganizer(e.target.value)}>
            <option value="">Semua</option>
            {ORGANIZER_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="rekod-filter-field rekod-filter-search">
          <label htmlFor="rekod-filter-cari">Cari</label>
          <input
            id="rekod-filter-cari"
            type="text"
            className="search-box"
            placeholder="Cari nama program..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {deleteError && <p className="form-error">{deleteError}</p>}
      {loading && <p className="search-status">Memuatkan...</p>}
      {!loading && error && <p className="form-error">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <p className="empty-state">
          {hasFilterActive ? 'Tiada rekod yang sepadan dengan carian atau penapis.' : 'Tiada rekod OPR ditemui.'}
        </p>
      )}

      {!loading && !error && records.length > 0 && (
        <>
          {/* Desktop/tablet - jadual (disembunyikan pada mobile melalui CSS) */}
          <table className="rekod-table">
            <thead>
              <tr>
                <th>BIL</th>
                <th>TAHUN</th>
                <th>ANJURAN</th>
                <th>NAMA PROGRAM</th>
                <th>TARIKH</th>
                <th>TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={record.id}>
                  <td>{(page - 1) * 10 + index + 1}</td>
                  <td>{tahunDaripadaTarikh(record.program_date)}</td>
                  <td>{record.organizer || '—'}</td>
                  <td className="rekod-table-name">{record.program_name}</td>
                  <td>{formatTarikhMelayu(record.program_date)}</td>
                  <td>
                    <div className="rekod-actions">
                      <a
                        href={`/api/opr/${record.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rekod-action-link"
                        aria-label={`Lihat PDF ${record.program_name}`}
                        title="Lihat PDF"
                      >
                        Lihat
                      </a>
                      <a
                        href={`/api/opr/${record.id}/pdf?download=1`}
                        className="rekod-action-link"
                        aria-label={`Muat turun PDF ${record.program_name}`}
                        title="Muat Turun"
                      >
                        Muat Turun
                      </a>
                      {admin && (
                        <button
                          type="button"
                          className="rekod-action-link rekod-action-delete"
                          onClick={() => {
                            setDeleteError('');
                            setConfirmTarget(record);
                          }}
                          aria-label={`Padam ${record.program_name}`}
                          title="Padam"
                        >
                          Padam
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile - senarai padat (disembunyikan pada desktop melalui CSS) */}
          <ul className="rekod-card-list">
            {records.map((record, index) => (
              <li key={record.id} className="rekod-card">
                <div className="rekod-card-bil">#{(page - 1) * 10 + index + 1}</div>
                <div className="rekod-card-name">{record.program_name}</div>
                <div className="rekod-card-meta">
                  {tahunDaripadaTarikh(record.program_date)} · {record.organizer || '—'} ·{' '}
                  {formatTarikhMelayu(record.program_date)}
                </div>
                <div className="rekod-actions">
                  <a
                    href={`/api/opr/${record.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-small"
                    aria-label={`Lihat PDF ${record.program_name}`}
                  >
                    Lihat
                  </a>
                  <a
                    href={`/api/opr/${record.id}/pdf?download=1`}
                    className="btn btn-secondary btn-small"
                    aria-label={`Muat turun PDF ${record.program_name}`}
                  >
                    Muat Turun
                  </a>
                  {admin && (
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => {
                        setDeleteError('');
                        setConfirmTarget(record);
                      }}
                      aria-label={`Padam ${record.program_name}`}
                    >
                      Padam
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="rekod-pagination-bar">
            <span className="rekod-pagination-status">
              Memaparkan {rangeStart}–{rangeEnd} daripada {total} rekod
            </span>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <ConfirmDeleteModal
        record={confirmTarget}
        deleting={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
