import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatMasa } from '../utils/editTokens';
import { designLabel } from '../utils/designOptions';

// Kemas Kini 2: sejarah versi ringkas. Pengguna biasa (pemegang token) melihat
// senarai sahaja; Admin turut mendapat maklumat audit & pautan ke PDF versi
// terdahulu (endpoint khusus, Admin sahaja). Paparan BACA SAHAJA - tiada
// tindakan yang boleh mengubah versi lama.
function labelFor(version, currentVersion) {
  if (version.version_no === currentVersion) return 'Terkini';
  if (version.source === 'create' || version.version_no === 1) return 'Asal';
  return 'Pembetulan';
}

export default function VersionHistory({ id, token, hideWhenSingle = false, emptyMessage = '' }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getOprVersions(id, token)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id, token]);

  if (failed && emptyMessage) return <p className="text-muted">{emptyMessage}</p>;
  if (!data || (hideWhenSingle && data.versions.length < 2)) return null;

  return (
    <section className="version-history" aria-label="Sejarah versi OPR">
      <h2 className="section-heading">Sejarah Versi</h2>
      {data.duplicated_from_id && (
        <p className="text-muted">
          Dijana melalui Duplicate &amp; Edit daripada{' '}
          <Link to={`/opr/${data.duplicated_from_id}/lihat`}>OPR #{data.duplicated_from_id}</Link>.
        </p>
      )}
      <ul>
        {data.versions.map((v) => (
          <li key={v.version_no} className={v.version_no === data.current_version ? 'is-current' : undefined}>
            <div>
              <strong>
                Versi {v.version_no} — {labelFor(v, data.current_version)}
              </strong>
              <span className="version-history-meta">
                {formatMasa(v.created_at)}
                {v.edited_by ? ` · ${v.edited_by}` : ''}
                {v.design_id ? ` · Reka bentuk ${designLabel(v.design_id)}` : ''}
              </span>
            </div>
            {data.can_open_versions && (
              <div className="version-history-actions">
                <Link
                  className="rekod-action-link"
                  to={
                    v.version_no === data.current_version ? `/opr/${id}/lihat` : `/opr/${id}/versi/${v.version_no}/lihat`
                  }
                >
                  Lihat
                </Link>
                <a
                  className="rekod-action-link"
                  href={
                    v.version_no === data.current_version
                      ? `/api/opr/${id}/pdf?download=1`
                      : `/api/opr/${id}/versions/${v.version_no}/pdf?download=1`
                  }
                >
                  Muat Turun
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
