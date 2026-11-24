import { Link } from 'react-router-dom';
import { editStatusFor } from '../utils/editTokens';

// Kemas Kini 2: status suntingan bagi satu rekod dalam senarai (Rekod OPR /
// Dashboard Admin). "Boleh Edit" hanya jika pelayar ini memegang token yang
// belum tamat, atau Admin dan server melaporkan rekod masih dalam tempoh.
// Selain itu "Dikunci". Backend tetap menyemak semula setiap permintaan.
export default function EditStatus({ record, isAdmin, variant = 'link' }) {
  const editable = editStatusFor(record, isAdmin) === 'editable';
  const linkClass = variant === 'button' ? 'btn btn-secondary btn-small' : 'rekod-action-link';

  return (
    <>
      <span
        className={`edit-badge ${editable ? 'is-editable' : 'is-locked'}`}
        title={editable ? 'Boleh diedit dalam tempoh 24 jam' : 'Tidak boleh diedit (tempoh tamat atau tiada kebenaran pada peranti ini)'}
      >
        {editable ? 'Boleh Edit' : 'Dikunci'}
      </span>
      {editable && (
        <Link to={`/opr/${record.id}/edit`} className={linkClass} aria-label={`Edit ${record.program_name}`}>
          Edit
        </Link>
      )}
      {isAdmin && record.current_version > 1 && (
        <Link to={`/opr/${record.id}/sejarah`} className={linkClass} aria-label={`Sejarah versi ${record.program_name}`}>
          Sejarah
        </Link>
      )}
    </>
  );
}
