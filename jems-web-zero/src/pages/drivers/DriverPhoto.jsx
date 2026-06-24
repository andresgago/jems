import { useRef, useState } from 'react';
import { driversService } from '../../services/drivers';
import { mediaUrl } from '../../utils/media';

export default function DriverPhoto({ driverId, photo, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await driversService.uploadPhoto(driverId, file);
      onChange();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove photo?')) return;
    setBusy(true);
    try {
      await driversService.deletePhoto(driverId);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-flex align-items-center gap-2">
      {photo ? (
        <img
          src={mediaUrl(photo)}
          alt="Driver"
          className="rounded-circle border"
          style={{ width: 48, height: 48, objectFit: 'cover' }}
        />
      ) : (
        <span
          className="rounded-circle bg-secondary-subtle d-inline-flex align-items-center justify-content-center"
          style={{ width: 48, height: 48 }}
        >
          <i className="bi bi-person fs-4 text-secondary" />
        </span>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="d-none"
        aria-label="Driver photo"
        onChange={handleFile}
      />
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <i className="bi bi-camera me-1" />{photo ? 'Change' : 'Add Photo'}
      </button>
      {photo && (
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          disabled={busy}
          title="Remove photo"
          onClick={handleRemove}
        >
          <i className="bi bi-trash" />
        </button>
      )}
    </div>
  );
}
