import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { citiesService } from '../../services/cities';
import { useOptions } from '../../hooks/useOptions';

const FK_FIELDS = ['state'];
const NUMBER_FIELDS = [];
const DATE_FIELDS = [];

const EMPTY = {
  name: '',
  zip: '',
  state: '',
  timezone: '',
  active: true,
};

function buildPayload(form) {
  const payload = { ...form };
  for (const f of FK_FIELDS) {
    payload[f] = payload[f] !== '' && payload[f] != null ? Number(payload[f]) : null;
  }
  for (const f of NUMBER_FIELDS) {
    payload[f] = payload[f] !== '' ? Number(payload[f]) : null;
  }
  for (const f of DATE_FIELDS) {
    payload[f] = payload[f] || null;
  }
  return payload;
}

export default function CityFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingCity, setLoadingCity] = useState(isEdit);

  const states = useOptions('/locations/states/');

  useEffect(() => {
    if (!isEdit) return;
    setLoadingCity(true);
    citiesService.get(id)
      .then(({ data }) => {
        setForm({
          name: data.name || '',
          zip: data.zip || '',
          state: data.state ?? '',
          timezone: data.timezone || '',
          active: data.active ?? true,
        });
      })
      .catch(() => {})
      .finally(() => setLoadingCity(false));
  }, [id, isEdit]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    const zip = form.zip.trim();
    if (!zip) e.zip = 'Zip is required.';
    else if (!/^\d{5}$/.test(zip)) e.zip = 'Zip must be exactly 5 digits.';
    if (!form.state) e.state = 'State is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEdit) {
        await citiesService.update(id, payload);
        navigate(`/settings/cities/${id}`);
      } else {
        const { data } = await citiesService.create(payload);
        navigate(`/settings/cities/${data.id}`);
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        for (const [k, v] of Object.entries(data)) {
          mapped[k] = Array.isArray(v) ? v.join(' ') : String(v);
        }
        setErrors(mapped);
      } else {
        setErrors({ non_field_errors: 'An error occurred. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingCity) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Link to="/settings/cities" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1" />Cities
          </Link>
          <h4 className="mb-0 mt-1">{isEdit ? 'Edit City' : 'Create City'}</h4>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {errors.non_field_errors && (
          <div className="alert alert-danger">{errors.non_field_errors}</div>
        )}

        <div className="card mb-3">
          <div className="card-header py-2 bg-light">
            <span className="fw-semibold"><i className="bi bi-geo-alt me-2" />City Information</span>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="control-label">Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control form-control-sm ${errors.name ? 'is-invalid' : ''}`}
                  value={form.name}
                  onChange={(e) => set('name')(e.target.value)}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>

              <div className="col-md-3">
                <label className="control-label">Zip Code <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control form-control-sm ${errors.zip ? 'is-invalid' : ''}`}
                  value={form.zip}
                  onChange={(e) => set('zip')(e.target.value)}
                  maxLength={5}
                />
                {errors.zip && <div className="invalid-feedback">{errors.zip}</div>}
              </div>

              <div className="col-md-4">
                <label className="control-label">State <span className="text-danger">*</span></label>
                <select
                  className={`form-select form-select-sm ${errors.state ? 'is-invalid' : ''}`}
                  value={form.state}
                  onChange={(e) => set('state')(e.target.value)}
                >
                  <option value="">— Select state —</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.abbreviation})</option>
                  ))}
                </select>
                {errors.state && <div className="invalid-feedback">{errors.state}</div>}
              </div>

              <div className="col-md-5">
                <label className="control-label">Timezone</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={form.timezone}
                  onChange={(e) => set('timezone')(e.target.value)}
                  placeholder="e.g. America/New_York"
                />
              </div>

              <div className="col-md-3 d-flex align-items-end">
                <label className="d-flex align-items-center gap-2 mb-0">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={form.active}
                    onChange={(e) => set('active')(e.target.checked)}
                  />
                  Active
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
            {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            {isEdit ? 'Save Changes' : 'Create City'}
          </button>
          <Link
            to={isEdit ? `/settings/cities/${id}` : '/settings/cities'}
            className="btn btn-sm btn-outline-secondary"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
