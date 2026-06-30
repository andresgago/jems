import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { truckMaintenanceService } from '../../services/truckMaintenance';
import { trucksService } from '../../services/trucks';

const TIME_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: i === 0 ? '0 Months' : i === 1 ? '1 Month' : `${i} Months`,
}));

const TIME_YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => ({
  value: i,
  label: i === 0 ? '0 Years' : i === 1 ? '1 Year' : `${i} Years`,
}));

const TODAY = new Date().toISOString().split('T')[0];

const FK_FIELDS = ['truck'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['maintenance_miles', 'odometer_start', 'odometer_current', 'driven_miles'];
const INT_FIELDS = ['time_year', 'time_month'];

function buildPayload(form) {
  const out = { ...form };
  FK_FIELDS.forEach((f) => { out[f] = out[f] !== '' ? Number(out[f]) : null; });
  DATE_FIELDS.forEach((f) => { out[f] = out[f] || null; });
  NUMBER_FIELDS.forEach((f) => { out[f] = out[f] !== '' ? Number(out[f]) : 0; });
  INT_FIELDS.forEach((f) => { out[f] = Number(out[f]); });
  out.miles_alert = out.miles_alert ? 1 : 0;
  out.time_alert = out.time_alert ? 1 : 0;
  out.is_done = out.is_done ? true : false;
  return out;
}

const EMPTY = {
  truck: '',
  date: TODAY,
  miles_alert: false,
  maintenance_miles: 13000,
  time_alert: false,
  time_year: 0,
  time_month: 0,
  odometer_start: 0,
  odometer_current: 0,
  is_done: false,
  driven_miles: 0,
  detail: '',
};

export default function TruckMaintenanceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [trucks, setTrucks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    truckMaintenanceService.get(id).then((r) => {
      const d = r.data;
      setForm({
        truck: d.truck ?? '',
        date: d.date ?? TODAY,
        miles_alert: Boolean(d.miles_alert),
        maintenance_miles: d.maintenance_miles ?? 13000,
        time_alert: Boolean(d.time_alert),
        time_year: d.time_year ?? 0,
        time_month: d.time_month ?? 0,
        odometer_start: d.odometer_start ?? 0,
        odometer_current: d.odometer_current ?? 0,
        is_done: Boolean(d.is_done),
        driven_miles: d.driven_miles ?? 0,
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
    if (!payload.truck) { setErrors({ truck: 'Truck is required.' }); return; }
    if (!payload.date) { setErrors({ date: 'Date is required.' }); return; }
    setSaving(true);
    setErrors({});
    try {
      if (isEdit) {
        const { truck: _t, ...rest } = payload;
        await truckMaintenanceService.update(id, rest);
      } else {
        await truckMaintenanceService.create(payload);
      }
      navigate('/fleet/truck-maintenance');
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
          {isEdit ? 'Edit Truck Maintenance' : 'Create Truck Maintenance'}
        </h5>
      </div>

      {errors.non_field_errors && (
        <div className="alert alert-danger">{errors.non_field_errors}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">Main Info</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Truck <span className="text-danger">*</span></label>
                <select
                  className={`form-select${errors.truck ? ' is-invalid' : ''}`}
                  value={form.truck}
                  onChange={set('truck')}
                  disabled={isEdit}
                >
                  <option value="">Select truck…</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>{t.number}</option>
                  ))}
                </select>
                {errors.truck && <div className="invalid-feedback">{errors.truck}</div>}
              </div>

              <div className="col-md-3">
                <label className="form-label">Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className={`form-control${errors.date ? ' is-invalid' : ''}`}
                  value={form.date}
                  onChange={set('date')}
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="col-md-3">
                <label className="form-label">Status</label>
                <div className="form-check mt-2">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.is_done)}
                      onChange={set('is_done')}
                    />
                    {' '}Done
                  </label>
                </div>
              </div>

              <div className="col-12">
                <label className="form-label">Detail</label>
                <textarea
                  className="form-control"
                  rows={4}
                  maxLength={500}
                  value={form.detail}
                  onChange={set('detail')}
                  placeholder="Describe the maintenance work…"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">Miles Alert</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-12">
                <div className="form-check">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.miles_alert)}
                      onChange={set('miles_alert')}
                    />
                    {' '}Enable miles-based alert
                  </label>
                </div>
              </div>
              {form.miles_alert && (
                <div className="col-md-4">
                  <label className="form-label">Alert at (miles) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    className={`form-control${errors.maintenance_miles ? ' is-invalid' : ''}`}
                    value={form.maintenance_miles}
                    onChange={set('maintenance_miles')}
                    min={0}
                    step={100}
                  />
                  {errors.maintenance_miles && <div className="invalid-feedback">{errors.maintenance_miles}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">Time Alert</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-12">
                <div className="form-check">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.time_alert)}
                      onChange={set('time_alert')}
                    />
                    {' '}Enable time-based alert
                  </label>
                </div>
              </div>
              {form.time_alert && (
                <>
                  <div className="col-md-3">
                    <label className="form-label">Years</label>
                    <select
                      className="form-select"
                      value={form.time_year}
                      onChange={set('time_year')}
                    >
                      {TIME_YEAR_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Months</label>
                    <select
                      className="form-select"
                      value={form.time_month}
                      onChange={set('time_month')}
                    >
                      {TIME_MONTH_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">Odometer</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Odometer Start</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.odometer_start}
                  onChange={set('odometer_start')}
                  min={0}
                  step={1}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Odometer Current</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.odometer_current}
                  onChange={set('odometer_current')}
                  min={0}
                  step={1}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Driven Miles</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.driven_miles}
                  onChange={set('driven_miles')}
                  min={0}
                  step={0.1}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
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
