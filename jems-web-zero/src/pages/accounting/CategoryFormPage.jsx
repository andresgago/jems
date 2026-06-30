import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { categoriesService } from '../../services/accounting';
import api from '../../services/api';
import PhotoCropper from '../../components/PhotoCropper';

const FK_FIELDS = ['category_type', 'engine_type', 'cabin_type', 'transmission_type'];

const EMPTY = {
  code: '',
  name: '',
  category_type: '',
  is_truck_part: false,
  engine_type: '',
  cabin_type: '',
  transmission_type: '',
  status: '1',
  _currentPhoto: null, // existing photo URL shown in edit mode (not sent to API)
};

function buildPayload(form, photo) {
  const payload = { ...form };
  delete payload._currentPhoto; // UI-only, never sent to API
  FK_FIELDS.forEach((f) => {
    payload[f] = payload[f] ? Number(payload[f]) : null;
  });
  payload.is_active = payload.status === '1';
  delete payload.status;
  if (!payload.is_truck_part) {
    payload.engine_type = null;
    payload.cabin_type = null;
    payload.transmission_type = null;
  }
  if (photo) {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== null && v !== undefined) fd.append(k, v);
    });
    fd.append('photo', photo);
    return fd;
  }
  return payload;
}

function Section({ title, icon, children }) {
  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold">{icon && <i className={`bi ${icon} me-2`} />}{title}</span>
      </div>
      <div className="card-body"><div className="row g-3">{children}</div></div>
    </div>
  );
}

function Text({ label, value, onChange, required, col = 'col-md-4', maxLength }) {
  return (
    <div className={col}>
      <label className="control-label">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      <input
        type="text"
        className="form-control form-control-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, col = 'col-md-4', required, placeholder = '—' }) {
  return (
    <div className={col}>
      <label className="control-label">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      <select className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function CategoryFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [engineTypes, setEngineTypes] = useState([]);
  const [cabinTypes, setCabinTypes] = useState([]);
  const [transmissionTypes, setTransmissionTypes] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/accounting/category-types/'),
      api.get('/fleet/engine-types/'),
      api.get('/fleet/cabin-types/'),
      api.get('/fleet/transmission-types/'),
    ]).then(([ct, et, cbt, tt]) => {
      setCategoryTypes(ct.data.filter((t) => t.is_active));
      setEngineTypes(et.data.filter((t) => t.is_active));
      setCabinTypes(cbt.data.filter((t) => t.is_active));
      setTransmissionTypes(tt.data.filter((t) => t.is_active));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    categoriesService.get(id)
      .then((r) => {
        const c = r.data;
        setForm({
          code: c.code || '',
          name: c.name || '',
          category_type: c.category_type ? String(c.category_type) : '',
          is_truck_part: Boolean(c.is_truck_part),
          engine_type: c.engine_type ? String(c.engine_type) : '',
          cabin_type: c.cabin_type ? String(c.cabin_type) : '',
          transmission_type: c.transmission_type ? String(c.transmission_type) : '',
          status: c.is_active ? '1' : '0',
          _currentPhoto: c.photo || null,
        });
      })
      .catch(() => setErrors({ _: 'Category not found.' }))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = 'Code is required.';
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.category_type) e.category_type = 'Type is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const payload = buildPayload(form, photo);
      const isFormData = payload instanceof FormData;
      const config = isFormData ? { headers: { 'Content-Type': undefined } } : {};
      if (isEdit) {
        await categoriesService.update(id, payload);
        navigate(`/accounting/categories/${id}`);
      } else {
        const r = isFormData
          ? await api.post('/accounting/categories/', payload, config)
          : await categoriesService.create(payload);
        navigate(`/accounting/categories/${r.data.id}`);
      }
    } catch (err) {
      const data = err.response?.data || {};
      const mapped = {};
      if (data.detail) mapped._ = data.detail;
      if (data.code) mapped.code = Array.isArray(data.code) ? data.code[0] : data.code;
      if (data.name) mapped.name = Array.isArray(data.name) ? data.name[0] : data.name;
      if (data.category_type) mapped.category_type = Array.isArray(data.category_type) ? data.category_type[0] : data.category_type;
      setErrors(Object.keys(mapped).length ? mapped : { _: 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  const typeOptions = categoryTypes.map((t) => ({
    value: String(t.id),
    label: t.unit_of_measure ? `${t.name} (${t.unit_of_measure})` : t.name,
  }));
  const engineOptions = engineTypes.map((t) => ({ value: String(t.id), label: t.name }));
  const cabinOptions = cabinTypes.map((t) => ({ value: String(t.id), label: t.name }));
  const transmissionOptions = transmissionTypes.map((t) => ({ value: String(t.id), label: t.name }));
  const statusOptions = [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }];

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link to="/accounting/categories" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1" />Categories
        </Link>
        <h5 className="mb-0 ms-1">
          <i className="bi bi-tag me-2" />{isEdit ? `Edit Category — ${form.code}` : 'New Category'}
        </h5>
      </div>

      {errors._ && <div className="alert alert-danger">{errors._}</div>}

      <form onSubmit={handleSubmit}>
        <Section title="Category Info" icon="bi-tag">
          <Text
            label="Code"
            value={form.code}
            onChange={(v) => set('code', v)}
            required
            col="col-md-3"
            maxLength={30}
          />
          {errors.code && <div className="col-md-9 text-danger small align-self-end">{errors.code}</div>}
          <Text
            label="Name"
            value={form.name}
            onChange={(v) => set('name', v)}
            required
            col="col-md-9"
            maxLength={200}
          />
          {errors.name && <div className="col-12 text-danger small">{errors.name}</div>}
          <Select
            label="Type"
            value={form.category_type}
            onChange={(v) => set('category_type', v)}
            options={typeOptions}
            col="col-md-6"
            required
            placeholder="Select type…"
          />
          {errors.category_type && <div className="col-md-6 text-danger small align-self-end">{errors.category_type}</div>}
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => set('status', v)}
            options={statusOptions}
            col="col-md-3"
          />
          <div className="col-12">
            <label className="control-label">Photo</label>
            <div className="mt-1">
              <PhotoCropper
                onCrop={(blob) => setPhoto(blob)}
                currentPhoto={isEdit && form._currentPhoto ? form._currentPhoto : null}
              />
            </div>
          </div>
        </Section>

        <Section title="Truck Part" icon="bi-tools">
          <div className="col-12">
            <label>
              <input
                type="checkbox"
                className="form-check-input me-2"
                checked={form.is_truck_part}
                onChange={(e) => set('is_truck_part', e.target.checked)}
              />
              Is Truck Part
            </label>
          </div>
          {form.is_truck_part && (
            <>
              <Select
                label="Engine"
                value={form.engine_type}
                onChange={(v) => set('engine_type', v)}
                options={engineOptions}
                col="col-md-4"
                placeholder="Not Applicable"
              />
              <Select
                label="Cabin / Model"
                value={form.cabin_type}
                onChange={(v) => set('cabin_type', v)}
                options={cabinOptions}
                col="col-md-4"
                placeholder="Not Applicable"
              />
              <Select
                label="Transmission"
                value={form.transmission_type}
                onChange={(v) => set('transmission_type', v)}
                options={transmissionOptions}
                col="col-md-4"
                placeholder="Not Applicable"
              />
            </>
          )}
        </Section>

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving…</> : (isEdit ? 'Save Changes' : 'Create Category')}
          </button>
          <Link to="/accounting/categories" className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
