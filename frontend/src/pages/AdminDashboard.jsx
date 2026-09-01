import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useOprSearch } from '../hooks/useOprSearch';
import { formatTarikhMelayu } from './opr-form.constants';
import { api } from '../api/client';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

export default function AdminDashboard() {
  const { admin, loading: authLoading, logout } = useAdminAuth();
  const navigate = useNavigate();
  const search = useOprSearch();

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (authLoading) {
    return (
      <div className="page">
        <p>Memuatkan...</p>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleQueryChange = (e) => {
    search.setQuery(e.target.value);
    setSuccessMessage('');
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const result = await api.deleteOpr(confirmTarget.id);
      search.removeRecord(confirmTarget.id); // buang dari senarai tanpa fetch semula, kekalkan query
      setSuccessMessage(result.message);
      setConfirmTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <h1>Dashboard Admin</h1>
      <p>
        Log masuk sebagai <strong>{admin.name}</strong> ({admin.username}).
      </p>

      <input
        type="text"
        className="search-box"
        placeholder="Cari nama program..."
        value={search.query}
        onChange={handleQueryChange}
        autoComplete="off"
      />

      {successMessage && <p className="success-inline">{successMessage}</p>}
      {deleteError && <p className="form-error">{deleteError}</p>}

      {search.loading && <p className="search-status">Mencari...</p>}
      {!search.loading && search.error && <p className="form-error">{search.error}</p>}
      {!search.loading && !search.error && search.records.length === 0 && (
        <p className="empty-state">Tiada rekod OPR ditemui.</p>
      )}

      {!search.loading && !search.error && search.records.length > 0 && (
        <>
          <ul className="record-list">
            {search.records.map((record) => (
              <li key={record.id} className="record-card">
                <div className="record-name">{record.program_name}</div>
                <div className="record-meta">
                  {formatTarikhMelayu(record.program_date)} · Disediakan oleh: {record.prepared_by}
                </div>
                <div className="record-actions record-actions-admin">
                  <a
                    className="btn btn-secondary btn-small"
                    href={`/api/opr/${record.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lihat OPR
                  </a>
                  <a className="btn btn-secondary btn-small" href={`/api/opr/${record.id}/pdf?download=1`}>
                    Muat Turun
                  </a>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      setDeleteError('');
                      setConfirmTarget(record);
                    }}
                  >
                    Padam
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {search.hasMore && (
            <button
              type="button"
              className="btn btn-secondary btn-large"
              onClick={search.loadMore}
              disabled={search.loadingMore}
            >
              {search.loadingMore ? 'Memuatkan...' : 'Muat Lebih Banyak'}
            </button>
          )}
        </>
      )}

      <button type="button" className="btn btn-secondary" onClick={handleLogout}>
        Log Keluar
      </button>

      <ConfirmDeleteModal
        record={confirmTarget}
        deleting={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
