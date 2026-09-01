import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatTarikhMelayu } from './opr-form.constants';

export default function Home() {
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .recentOpr()
      .then((data) => setRecent(data.records.slice(0, 5)))
      .catch(() => setError('Ralat memuatkan OPR terkini.'));
  }, []);

  return (
    <div className="page page-home">
      <div className="home-hero">
        <img
          src="/assets/logo-sekolah.svg"
          alt="Logo SABK Maahad Al-Khair Lil Banat"
          className="home-logo"
        />
        <h1>Sistem OPR</h1>
        <p className="home-subtitle">SABK Maahad Al-Khair Lil Banat (AFT6003)</p>
      </div>

      <div className="home-actions">
        <Link to="/buat" className="btn btn-primary btn-large">
          + Buat OPR
        </Link>
        <Link to="/rekod" className="btn btn-secondary btn-large">
          Cari Rekod OPR
        </Link>
      </div>

      <section>
        <h2>OPR Terkini</h2>
        {error && <p className="form-error">{error}</p>}
        {!error && recent === null && <p className="empty-state">Memuatkan...</p>}
        {!error && recent && recent.length === 0 && (
          <p className="empty-state">Tiada rekod OPR ditemui.</p>
        )}
        {!error && recent && recent.length > 0 && (
          <ul className="record-list">
            {recent.map((record) => (
              <li key={record.id} className="record-card">
                <div className="record-name">{record.program_name}</div>
                <div className="record-meta">{formatTarikhMelayu(record.program_date)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
