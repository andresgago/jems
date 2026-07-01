import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { accidentsService } from '../../services/accidents';
import { trucksService } from '../../services/trucks';
import { trailersService } from '../../services/trailers';
import { driversService } from '../../services/drivers';
import { citiesService } from '../../services/cities';

const FK_FIELDS = ['truck', 'trailer', 'driver', 'city', 'state'];
const INT_FIELDS = ['death_count', 'fatal_injuries'];
const FILE_LABELS = {
  police_report: 'Police Report',
  post_accident: 'Post Accident',
};

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
  city: '',
  state: '',
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
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingRecord, setLoadingRecord] = useState(isEdit);
  const [existingFiles, setExistingFiles] = useState({
    police_report: null,
    post_accident: null,
  });
  const [files, setFiles] = useState({
    police_report: null,
    post_accident: null,
  });

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
    trailersService.list().then((r) => setTrailers(r.data)).catch(() => {});
    driversService.list().then((r) => setDrivers(r.data)).catch(() => {});
    citiesService.states().then((r) => setStates(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.state) { setCities([]); return; }
    citiesService.list({ state: form.state }).then((r) => setCities(r.data)).catch(() => {});
  }, [form.state]);

  useEffect(() => {
    if (!isEdit) return;
    accidentsService.get(id).then((r) => {
      const d = r.data;
      setForm({
        date: d.date ? d.date.slice(0, 16) : '',
        truck: d.truck ?? '',
        trailer: d.trailer ?? '',
        driver: d.driver ?? '',
        city: d.city ?? '',
        state: d.state ?? '',
        address: d.address ?? '',
        crash_number: d.crash_number ?? '',
        tow_aways: Boolean(d.tow_aways),
        death_count: d.death_count ?? 0,
        fatal_injuries: d.fatal_injuries ?? 0,
      });
      setExistingFiles({
        police_report: d.police_report_file ?? null,
        post_accident: d.post_accident_file ?? null,
      });
      setLoadingRecord(false);
    }).catch(() => setLoadingRecord(false));
  }, [id, isEdit]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: val };
      if (field === 'state') next.city = '';
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload(form);
    setSaving(true);
    setErrors({});
    try {
      let accidentId = id;
      if (isEdit) {
        await accidentsService.update(id, payload);
      } else {
        const res = await accidentsService.create(payload);
        accidentId = res.data.id;
      }
      const uploads = Object.entries(files)
        .filter(([, file]) => file)
        .map(([slot, file]) => accidentsService.uploadFile(accidentId, slot, file));
      if (uploads.length) await Promise.all(uploads);
      navigate(`/fleet/accidents/${accidentId}`);
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
              <div className="col-md-6">
                <label className="form-label">FMCSA Crash Report Number</label>
                <input
                  type="text"
                  className={`form-control${errors.crash_number ? ' is-invalid' : ''}`}
                  value={form.crash_number}
                  onChange={set('crash_number')}
                  placeholder="Report number…"
                />
                {errors.crash_number && <div className="invalid-feedback">{errors.crash_number}</div>}
              </div>

              <div className="col-md-6">
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
                <label className="form-label">Driver</label>
                <select className={`form-select${errors.driver ? ' is-invalid' : ''}`} value={form.driver} onChange={set('driver')}>
                  <option value="">Select driver…</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                </select>
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

              <div className="col-12">
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
                <label className="form-label">State</label>
                <select className="form-select" value={form.state} onChange={set('state')}>
                  <option value="">Select state…</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.abbreviation})</option>)}
                </select>
              </div>

              <div className="col-md-8">
                <label className="form-label">City</label>
                <select className="form-select" value={form.city} onChange={set('city')} disabled={!form.state}>
                  <option value="">Select city…</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name} {c.zip ? `(${c.zip})` : ''}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">Documents</div>
          <div className="card-body">
            <div className="row g-3">
              {Object.entries(FILE_LABELS).map(([slot, label]) => (
                <div className="col-md-6" key={slot}>
                  <label className="form-label">{label}</label>
                  {existingFiles[slot] && (
                    <div className="small text-success mb-1">
                      <i className="bi bi-file-earmark-check me-1" />
                      Current file uploaded
                    </div>
                  )}
                  <input
                    type="file"
                    className="form-control"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setFiles((prev) => ({ ...prev, [slot]: file }));
                    }}
                    aria-label={label}
                  />
                  {files[slot] && (
                    <div className="small text-muted mt-1">{files[slot].name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light fw-semibold">FMCSA Reportable Info</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Tow Aways</label>
                <select
                  className="form-select"
                  value={form.tow_aways ? '1' : '0'}
                  onChange={(e) => setForm((prev) => ({ ...prev, tow_aways: e.target.value === '1' }))}
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Death Number</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.death_count}
                  onChange={set('death_count')}
                  min={0}
                />
              </div>
              <div className="col-md-4">
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
