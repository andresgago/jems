import { useRef, useState } from 'react';
import { trailersService, TRAILER_FILE_SLOTS } from '../../services/trailers';
import { mediaUrl } from '../../utils/media';

function SlotRow({ slot, label, value, busy, onUpload, onClear }) {
  const fileRef = useRef(null);

  return (
    <tr>
      <td className="align-middle">{label}</td>
      <td className="align-middle">
        {value ? (
          <a href={mediaUrl(value)} target="_blank" rel="noreferrer" className="text-decoration-none">
            <i className="bi bi-file-earmark-arrow-down me-1" />Download
          </a>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="align-middle text-end">
        <input
          ref={fileRef}
          type="file"
          className="d-none"
          aria-label={`${label} file`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(slot, file);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary me-1"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <i className="bi bi-upload me-1" />{value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            title={`Remove ${label}`}
            disabled={busy}
            onClick={() => onClear(slot)}
          >
            <i className="bi bi-trash" />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function TrailerFiles({ trailerId, trailer, onChange }) {
  const [busy, setBusy] = useState(false);

  const upload = async (slot, file) => {
    setBusy(true);
    try {
      await trailersService.uploadFile(trailerId, slot, file);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const clear = async (slot) => {
    if (!window.confirm('Remove this file?')) return;
    setBusy(true);
    try {
      await trailersService.deleteFile(trailerId, slot);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold"><i className="bi bi-paperclip me-2" />Files</span>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead className="table-light">
              <tr><th>Document</th><th>File</th><th /></tr>
            </thead>
            <tbody>
              {TRAILER_FILE_SLOTS.map(({ slot, label, field }) => (
                <SlotRow
                  key={slot}
                  slot={slot}
                  label={label}
                  value={trailer[field]}
                  busy={busy}
                  onUpload={upload}
                  onClear={clear}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
