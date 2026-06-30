import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trailerMaintenanceService } from '../../services/trailerMaintenance';
import { trailersService } from '../../services/trailers';

const TIME_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: i === 0 ? '0 Months' : i === 1 ? '1 Month' : `${i} Months`,
}));

const TIME_YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => ({
  value: i,
  label: i === 0 ? '0 Years' : i === 1 ? '1 Year' : `${i} Years`,
}));

function todayISO() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().split('T')[0];
}

const TODAY = todayISO();

const FK_FIELDS = ['trailer'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['miles'];
const INT_FIELDS = ['time_year', 'time_month'];

function buildPayload(form) {
  const out = { ...form };
  FK_FIELDS.forEach((f) => { out[f] = out[f] !== '' ? Number(out[f]) : null; });
  DATE_FIELDS.forEach((f) => { out[f] = out[f] || null; });
  NUMBER_FIELDS.forEach((f) => { out[f] = out[f] !== '' ? Number(out[f]) : 0; });
  INT_FIELDS.forEach((f) => { out[f] = Number(out[f]); });
  out.miles_alert = out.miles_alert ? 1 : 0;
  out.time_alert = out.time_alert ? 1 : 0;
  return out;
}

const EMPTY = {
  trailer: '',
  date: TODAY,
  miles: 13000,
  miles_alert: false,
  time_alert: false,
  time_year: 0,
  time_month: 0,
  detail: '',
};

export default function TrailerMaintenanceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [trailers, setTrailers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  useEffect(() => {
    trailersService.list().then((r) => setTrailers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    trailerMaintenanceService.get(id).then((r) => {
      const d = r.data;
      setForm({
        trailer: d.trailer ?? '',
        date: d.date ?? TODAY,
        miles: d.miles ?? 0,
        miles_alert: Boolean(d.miles_alert),
        time_alert: Boolean(d.time_alert),
        time_year: d.time_year ?? 0,
        time_month: d.time_month ?? 0,
        detail: d.detail ?? '',
      });
      setLoadingRecord(false);
    }).catch(() => setLoadingRecord(false));
  }, [id, isEdit]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload(form);
    if (!payload.trailer) { setErrors({ trailer: 'Trailer is required.' }); return; }
    if (!payload.date) { setErrors({ date: 'Date is required.' }); return; }
    if (!payload.detail.trim()) { setErrors({ detail: 'Details cannot be blank.' }); return; }
    if (payload.miles_alert === 1 && payload.miles <= 0) {
      setErrors({ miles: 'Miles cannot be blank.' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      if (isEdit) {
        const { trailer: _t, ...rest } = payload;
        await trailerMaintenanceService.update(id, rest);
      } else {
        await trailerMaintenanceService.create(payload);
      }
      navigate('/fleet/trailer-maintenance');
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        setErrors(data);
      } else {
        setErrors({ non_field_errors: 'An error occurred. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingRecord) return <div className="text-muted p-4">Loading…</div>;

  return (
    <div>
      <div className="d-flex align-items-center mb-3 gap-2">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left" />
        </button>
        <h5 className="mb-0">
          <i className="bi bi-wrench me-2" />
          {isEdit ? 'Edit Trailer Maintenance' : 'Create Trailer Maintenance'}
        </h5>
      </div>

      {errors.non_field_errors && (
        <div className="alert alert-danger">{errors.non_field_errors}</div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 1120 }}>
        <div className="row g-3 align-items-end mb-3">
          <div className="col-md-5">
            <label className="form-label fw-semibold" htmlFor="trailer-maintenance-date">Date</label>
            <input
              id="trailer-maintenance-date"
              type="date"
              className={`form-control${errors.date ? ' is-invalid' : ''}`}
              value={form.date}
              onChange={set('date')}
            />
            {errors.date && <div className="invalid-feedback">{errors.date}</div>}
          </div>

          <div className="col-md-7">
            <label className="form-label fw-semibold" htmlFor="trailer-maintenance-trailer">Trailer</label>
            <select
              id="trailer-maintenance-trailer"
              className={`form-select${errors.trailer ? ' is-invalid' : ''}`}
              value={form.trailer}
              onChange={set('trailer')}
              disabled={isEdit}
            >
              <option value="">...</option>
              {trailers.map((t) => (
                <option key={t.id} value={t.id}>{t.number}{t.vin ? ` - ${t.vin}` : ''}</option>
              ))}
            </select>
            {errors.trailer && <div className="invalid-feedback">{errors.trailer}</div>}
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <div className="form-check mb-2">
              <input
                id="trailer-maintenance-miles-alert"
                type="checkbox"
                className="form-check-input"
                checked={Boolean(form.miles_alert)}
                onChange={set('miles_alert')}
              />
              <label className="form-check-label fw-semibold" htmlFor="trailer-maintenance-miles-alert">Miles Alert</label>
            </div>
            {form.miles_alert && (
              <>
                <label className="form-label fw-semibold" htmlFor="trailer-maintenance-miles">Miles</label>
                <input
                  id="trailer-maintenance-miles"
                  type="number"
                  className={`form-control${errors.miles ? ' is-invalid' : ''}`}
                  value={form.miles}
                  onChange={set('miles')}
                  min={0}
                  step={100}
                />
                {errors.miles && <div className="invalid-feedback">{errors.miles}</div>}
              </>
            )}
          </div>

          <div className="col-md-6">
            <div className="form-check mb-2">
              <input
                id="trailer-maintenance-time-alert"
                type="checkbox"
                className="form-check-input"
                checked={Boolean(form.time_alert)}
                onChange={set('time_alert')}
              />
              <label className="form-check-label fw-semibold" htmlFor="trailer-maintenance-time-alert">Time Alert</label>
            </div>
            {form.time_alert && (
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="trailer-maintenance-years">Years</label>
                  <select
                    id="trailer-maintenance-years"
                    className="form-select"
                    value={form.time_year}
                    onChange={set('time_year')}
                  >
                    {TIME_YEAR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold" htmlFor="trailer-maintenance-months">Month(es)</label>
                  <select
                    id="trailer-maintenance-months"
                    className="form-select"
                    value={form.time_month}
                    onChange={set('time_month')}
                  >
                    {TIME_MONTH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="trailer-maintenance-details">Details</label>
          <textarea
            id="trailer-maintenance-details"
            className={`form-control${errors.detail ? ' is-invalid' : ''}`}
            rows={5}
            maxLength={500}
            value={form.detail}
            onChange={set('detail')}
          />
          {errors.detail && <div className="invalid-feedback">{errors.detail}</div>}
        </div>

        <div className="d-flex gap-2">
          <button type="submit" className={isEdit ? 'btn btn-primary' : 'btn btn-success'} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
