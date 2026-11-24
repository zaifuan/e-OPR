import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import VersionHistory from '../components/VersionHistory';
import { getEditEntry } from '../utils/editTokens';

// Kemas Kini 2: halaman sejarah versi (/opr/:id/sejarah) - untuk audit Admin
// (atau pemegang token dalam tempoh 24 jam). Baca sahaja.
export default function SejarahOPR() {
  const { id } = useParams();
  const [token] = useState(() => getEditEntry(id)?.token || null);
  const [name, setName] = useState('');

  useEffect(() => {
    let active = true;
    api
      .getOprById(id)
      .then((r) => active && setName(r.program_name || ''))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="page">
      <h1>Sejarah Versi OPR</h1>
      {name && <p className="opr-viewer-subtitle">{name}</p>}
      <VersionHistory
        id={id}
        token={token}
        emptyMessage="Sejarah versi hanya boleh dilihat oleh Admin atau pemilik OPR dalam tempoh suntingan."
      />
      <Link className="btn btn-secondary" to={`/opr/${id}/lihat`}>
        Lihat OPR Terkini
      </Link>
    </div>
  );
}
