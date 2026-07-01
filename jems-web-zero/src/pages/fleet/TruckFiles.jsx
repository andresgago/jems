import { useRef, useState } from 'react';
import { trucksService, TRUCK_FILE_SLOTS } from '../../services/trucks';
import { mediaUrl } from '../../utils/media';

function SlotRow({ slot, label, value, busy, onUpload, onClear, onStore }) {
  const fileRef = useRef(null);
  const canStore = ['avi', 'registration'].includes(slot) && value;

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
        {canStore && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary me-1"
            title={`Send ${label} to Store`}
            disabled={busy}
            onClick={() => onStore(slot, label)}
          >
            <i className="bi bi-box-arrow-down" />
          </button>
        )}
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

export default function TruckFiles({ truckId, truck, onChange }) {
  const photoRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (slot, file) => {
    setBusy(true);
    try {
      await trucksService.uploadFile(truckId, slot, file);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const clear = async (slot) => {
    if (!window.confirm('Remove this file?')) return;
    setBusy(true);
    try {
      await trucksService.deleteFile(truckId, slot);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const store = async (slot, label) => {
    const storeLabel = slot === 'avi' ? 'Annual Vehicle Inspection' : label;
    if (!window.confirm(`Are you sure store the ${storeLabel}?`)) return;
    setBusy(true);
    try {
      await trucksService.storeFile(truckId, slot);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const deleteStored = async (fileId) => {
    if (!window.confirm('Are you sure delete the file?')) return;
    setBusy(true);
    try {
      await trucksService.deleteStoredFile(truckId, fileId);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const storedFiles = Array.isArray(truck.stored_files) ? truck.stored_files : [];

  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold"><i className="bi bi-paperclip me-2" />Files</span>
      </div>
      <div className="card-body">
        <div className="row">
          {/* Photo */}
          <div className="col-md-3 text-center mb-3 mb-md-0">
            {truck.photo ? (
              <img
                src={mediaUrl(truck.photo)}
                alt="Truck"
                className="img-fluid rounded border mb-2"
                style={{ maxHeight: 140, objectFit: 'cover' }}
              />
            ) : (
              <div
                className="bg-secondary-subtle rounded d-flex align-items-center justify-content-center mb-2"
                style={{ height: 140 }}
              >
                <i className="bi bi-truck fs-1 text-secondary" />
              </div>
            )}
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="d-none"
              aria-label="Truck photo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload('photo', file);
                if (photoRef.current) photoRef.current.value = '';
              }}
            />
            <div className="d-flex gap-1 justify-content-center">
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => photoRef.current?.click()}>
                <i className="bi bi-camera me-1" />{truck.photo ? 'Change' : 'Add Photo'}
              </button>
              {truck.photo && (
                <button type="button" className="btn btn-sm btn-outline-danger" title="Remove photo" disabled={busy} onClick={() => clear('photo')}>
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          </div>

          {/* Document slots */}
          <div className="col-md-9">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr><th>Document</th><th>File</th><th /></tr>
                </thead>
                <tbody>
                  {TRUCK_FILE_SLOTS.map(({ slot, label, field }) => (
                    <SlotRow
                      key={slot}
                      slot={slot}
                      label={label}
                      value={truck[field]}
                      busy={busy}
                      onUpload={upload}
                      onClear={clear}
                      onStore={store}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {storedFiles.length > 0 && (
              <div className="mt-3">
                <div className="small fw-semibold mb-1">Store</div>
                <table className="table table-sm table-bordered mb-0">
                  <tbody>
                    {storedFiles.map((file) => (
                      <tr key={file.id}>
                        <td>{file.type_label}</td>
                        <td>
                          <a href={mediaUrl(file.file)} target="_blank" rel="noreferrer" className="text-decoration-none">
                            <i className="bi bi-file-earmark-arrow-down me-1" />{file.date}
                          </a>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Delete"
                            disabled={busy}
                            onClick={() => deleteStored(file.id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
