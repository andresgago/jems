import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { accidentsService } from '../../services/accidents';
import { trucksService } from '../../services/trucks';
import { trailersService } from '../../services/trailers';
import { driversService } from '../../services/drivers';

const FK_FIELDS = ['truck', 'trailer', 'driver', 'city', 'state'];
const INT_FIELDS = ['death_count', 'fatal_injuries'];

function buildPayload(form) {
  const out = { ...form };
  FK_FIELDS.forEach((f) => { out[f] = out[f] !== '' ? Number(out[f]) : null; });
  INT_FIELDS.forEach((f) => { out[f] = out[f] !== '' ? Number(out[f]) : 0; });
  out.tow_aways = Boolean(out.tow_aways);
  out.date = out.date || null;
  return out;
}

const EMPTY = {
  date: '',
  truck: '',
  trailer: '',
  driver: '',
  address: '',
  crash_number: '',
  tow_aways: false,
  death_count: 0,
  fatal_injuries: 0,
};

export default function AccidentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
    trailersService.list().then((r) => setTrailers(r.data)).catch(() => {});
    driversService.list().then((r) => setDrivers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    accidentsService.get(id).then((r) => {
      const d = r.data;
      setForm({
        date: d.date ? d.date.slice(0, 16) : '',
        truck: d.truck ?? '',
        trailer: d.trailer ?? '',
        driver: d.driver ?? '',
        address: d.address ?? '',
        crash_number: d.crash_number ?? '',
        tow_aways: Boolean(d.tow_aways),
        death_count: d.death_count ?? 0,
        fatal_injuries: d.fatal_injuries ?? 0,
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
    setSaving(true);
    setErrors({});
    try {
      if (isEdit) {
        await accidentsService.update(id, payload);
        navigate(`/fleet/accidents/${id}`);
      } else {
        const res = await accidentsService.create(payload);
        navigate(`/fleet/accidents/${res.data.id}`);
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else setErrors({ non_field_errors: 'An error occurred.' });
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
          <i className="bi bi-exclamation-triangle me-2" />
          {isEdit ? 'Edit Accident' : 'Create Accident'}
        </h5>
      </div>

      {errors.non_field_errors && (
        <div className="alert alert-danger">{errors.non_field_errors}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">Accident Info</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Date &amp; Time <span className="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  className={`form-control${errors.date ? ' is-invalid' : ''}`}
                  value={form.date}
                  onChange={set('date')}
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label">Crash Number</label>
                <input
                  type="text"
                  className={`form-control${errors.crash_number ? ' is-invalid' : ''}`}
                  value={form.crash_number}
                  onChange={set('crash_number')}
                  placeholder="FMCSA report number…"
                />
                {errors.crash_number && <div className="invalid-feedback">{errors.crash_number}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.address}
                  onChange={set('address')}
                  placeholder="Highway / mile marker…"
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Truck</label>
                <select className="form-select" value={form.truck} onChange={set('truck')}>
                  <option value="">Select truck…</option>
                  {trucks.map((t) => <option key={t.id} value={t.id}>{t.number}</option>)}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Trailer</label>
                <select className="form-select" value={form.trailer} onChange={set('trailer')}>
                  <option value="">Select trailer…</option>
                  {trailers.map((t) => <option key={t.id} value={t.id}>{t.number}</option>)}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Driver</label>
                <select className="form-select" value={form.driver} onChange={set('driver')}>
                  <option value="">Select driver…</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">FMCSA Reportable Info</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <div className="form-check mt-2">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.tow_aways)}
                      onChange={set('tow_aways')}
                    />
                    {' '}Tow-aways involved
                  </label>
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label">Deaths</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.death_count}
                  onChange={set('death_count')}
                  min={0}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Fatal Injuries</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.fatal_injuries}
                  onChange={set('fatal_injuries')}
                  min={0}
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
