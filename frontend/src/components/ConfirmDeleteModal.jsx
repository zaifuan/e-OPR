export default function ConfirmDeleteModal({ record, deleting, onCancel, onConfirm }) {
  if (!record) return null;

  return (
    <div className="modal-backdrop" onClick={deleting ? undefined : onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Padam OPR?</h2>
        <p className="modal-record-name">{record.program_name}</p>
        <p className="modal-warning">
          Rekod dan fail PDF akan dipadam secara kekal. Tindakan ini tidak boleh dibatalkan.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
            Batal
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Memadam...' : 'Padam OPR'}
          </button>
        </div>
      </div>
    </div>
  );
}
