import { useState } from 'react';
import { loadsService } from '../../services/loads';

const STAR_CAPTIONS = {
  0: '',
  1: 'Extremely Poor',
  2: 'Very Poor',
  3: 'Poor',
  4: 'Ok',
  5: 'Ok',
  6: 'Ok',
  7: 'Ok',
  8: 'Good',
  9: 'Very Good',
  10: 'Extremely Good',
};

function captionClass(v) {
  if (v >= 8) return 'text-success';
  if (v >= 4) return 'text-info';
  if (v >= 1) return 'text-danger';
  return 'text-muted';
}

function StarPicker({ value, onChange, label }) {
  return (
    <div className="mb-3">
      <label className="form-label fw-semibold">{label}</label>
      <div className="d-flex align-items-center gap-1 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <i
            key={n}
            className={`bi bi-star${n <= value ? '-fill' : ''} text-warning fs-5`}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Rate ${n}`}
            onClick={() => onChange(n === value ? 0 : n)}
          />
        ))}
        {value > 0 && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 ms-1 text-muted"
            onClick={() => onChange(0)}
          >
            clear
          </button>
        )}
      </div>
      {value > 0 && (
        <small className={`mt-1 d-block ${captionClass(value)}`}>
          {value}/10 — {STAR_CAPTIONS[value]}
        </small>
      )}
    </div>
  );
}

export default function RateLoadModal({ load, onClose, onSaved }) {
  const [shipperRating, setShipperRating] = useState(load.shipper_rating ?? 0);
  const [receiverRating, setReceiverRating] = useState(load.receiver_rating ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const shipperLabel = load.shipper_name
    ? `${load.shipper_name} (Shipper Rating)`
    : 'Shipper Rating';
  const receiverLabel = load.receiver_name
    ? `${load.receiver_name} (Receiver Rating)`
    : 'Receiver Rating';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await loadsService.setRating(load.id, {
        shipper_rating: shipperRating,
        receiver_rating: receiverRating,
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving ratings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-modal-title"
      style={{ background: 'rgba(0,0,0,.5)' }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="rate-modal-title">
              Rate Load: {load.number}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <StarPicker
                label={shipperLabel}
                value={shipperRating}
                onChange={setShipperRating}
              />
              <StarPicker
                label={receiverLabel}
                value={receiverRating}
                onChange={setReceiverRating}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
