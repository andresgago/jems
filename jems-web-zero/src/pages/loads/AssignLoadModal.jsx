import { useEffect, useState } from 'react';
import { loadsService } from '../../services/loads';
import { trailersService } from '../../services/trailers';
import { trucksService } from '../../services/trucks';
import { driversService } from '../../services/drivers';

const DAYS_OPTIONS = Array.from({ length: 21 }, (_, i) => i);

export default function AssignLoadModal({ load, onClose, onSaved }) {
  const [form, setForm] = useState({
    driver: load.driver ?? '',
    truck: load.truck ?? '',
    trailer: load.trailer ?? '',
    is_drop: load.is_drop ? 1 : 0,
    drop_place: load.drop_place ?? '',
    drop_trailer: load.drop_trailer ?? 0,
    days_in_drop: load.days_in_drop ?? 0,
  });
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    driversService.list({ status: 1 }).then(({ data }) => {
      const items = Array.isArray(data) ? data : (data.results || []);
      setDrivers(items);
    }).catch(() => setDrivers([]));

    trucksService.list({ status: 1 }).then(({ data }) => {
      const items = Array.isArray(data) ? data : (data.results || []);
      setTrucks(items);
    }).catch(() => setTrucks([]));

    trailersService.options().then(({ data }) => {
      setTrailers(Array.isArray(data) ? data : []);
    }).catch(() => setTrailers([]));
  }, []);

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleIsDropChange = (val) => {
    const numVal = Number(val);
    setForm((f) => ({
      ...f,
      is_drop: numVal,
      drop_place: numVal === 0 ? '' : f.drop_place,
      drop_trailer: numVal === 0 ? 0 : f.drop_trailer,
      days_in_drop: numVal === 0 ? 0 : f.days_in_drop,
    }));
  };

  const buildPayload = () => ({
    driver: form.driver !== '' ? Number(form.driver) : null,
    truck: form.truck !== '' ? Number(form.truck) : null,
    trailer: form.trailer !== '' ? Number(form.trailer) : null,
    is_drop: Number(form.is_drop),
    drop_place: form.drop_place !== '' ? Number(form.drop_place) : null,
    drop_trailer: Number(form.drop_trailer) || 0,
    days_in_drop: Number(form.days_in_drop) || 0,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await loadsService.assign(load.id, buildPayload());
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving assignment.');
    } finally {
      setSaving(false);
    }
  };

  const isDrop = Number(form.is_drop) === 1;

  return (
    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="assign-modal-title">
              Update Load: {load.number}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              <div className="mb-3">
                <label className="form-label fw-semibold">Driver</label>
                <select
                  className="form-select"
                  value={form.driver}
                  onChange={(e) => setField('driver', e.target.value)}
                >
                  <option value="">—</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name || `${d.first_name} ${d.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="row">
                <div className="col-7">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Truck</label>
                    <select
                      className="form-select"
                      value={form.truck}
                      onChange={(e) => setField('truck', e.target.value)}
                    >
                      <option value="">—</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.number} - {t.vin} - {t.truck_type_name || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-5">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Trailer</label>
                    <select
                      className="form-select"
                      value={form.trailer}
                      onChange={(e) => setField('trailer', e.target.value)}
                    >
                      <option value="">—</option>
                      {trailers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.number} - {t.vin} - {t.trailer_type_name || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Is Drop Trailer</label>
                    <select
                      className="form-select"
                      value={form.is_drop}
                      onChange={(e) => handleIsDropChange(e.target.value)}
                    >
                      <option value={0}>NOT</option>
                      <option value={1}>YES</option>
                    </select>
                  </div>
                </div>
              </div>

              {isDrop && (
                <div className="row">
                  <div className="col-4">
                    <div className="mb-3">
                      <label className="form-label">Drop Trailer</label>
                      <select
                        className="form-select"
                        value={form.drop_place}
                        onChange={(e) => setField('drop_place', e.target.value)}
                      >
                        <option value="">—</option>
                        {trailers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.number} - {t.trailer_type_name || ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="mb-3">
                      <label className="form-label">Drop Trailer ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={form.drop_trailer}
                        onChange={(e) => setField('drop_trailer', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="mb-3">
                      <label className="form-label">Days in Drop</label>
                      <select
                        className="form-select"
                        value={form.days_in_drop}
                        onChange={(e) => setField('days_in_drop', Number(e.target.value))}
                      >
                        {DAYS_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
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
