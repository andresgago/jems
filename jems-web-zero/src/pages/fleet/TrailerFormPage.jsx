import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trailersService } from '../../services/trailers';
import { useOptions } from '../../hooks/useOptions';

const FK_FIELDS = ['trailer_type', 'plate_state', 'owner', 'carrier'];
const DATE_FIELDS = [
  'annual_inspection_expiration', 'purchase_date',
  'carrier_start_date', 'carrier_end_date',
];
const NUMBER_FIELDS = ['year', 'width', 'height', 'purchase_cost'];

const EMPTY = {
  number: '', vin: '', year: '', width: '0', height: '0',
  purchase_date: '', purchase_cost: '0',
  annual_inspection_expiration: '',
  plate_number: '', plate_state: '',
  trailer_type: '', loss_payee: '',
  is_rented: '0', status: '1',
  owner: '', carrier: '',
  carrier_start_date: '', carrier_end_date: '', carrier_end_reason: '',
};

// Field name and file-upload slot are the same string for all 3 trailer slots.
const FILE_SLOTS = ['agreement', 'annual_inspection', 'registration'];

function Text({ label, value, onChange, required, invalid, type = 'text', col = 'col-md-6' }) {
  return (
    <div className={col}>
      <label className="control-label">{label}{required && <span className="text-danger"> *</span>}</label>
      <input
        type={type}
        className={`form-control form-control-sm ${invalid ? 'is-invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid === true && <div className="legacy-field-error">{label} cannot be blank.</div>}
    </div>
  );
}

function Select({ label, value, onChange, options, col = 'col-md-6', placeholder = '...', includeBlank = true }) {
  return (
    <div className={col}>
      <label className="control-label">{label}</label>
      <select className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {includeBlank && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange, col = 'col-md-6' }) {
  return (
    <div className={col}>
      <label className="control-label">{label}</label>
      <div className="legacy-date-input">
        <span className="legacy-date-addon"><i className="bi bi-calendar3" /></span>
        <button type="button" className="legacy-date-clear" onClick={() => onChange('')} aria-label={`Clear ${label}`}>
          <i className="bi bi-x-lg" />
        </button>
        <input
          type="date"
          className="form-control form-control-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function FileInput({ label, value, onChange, col = 'col-md-6' }) {
  return (
    <div className={col}>
      <label className="control-label">{label}</label>
      <input
        aria-label={label}
        type="file"
        className="form-control form-control-sm legacy-file-input"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      {value && <div className="small text-muted mt-1">{value.name}</div>}
    </div>
  );
}

export default function TrailerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const trailerTypes = useOptions('/fleet/trailer-types/');
  const owners = useOptions('/fleet/owners/');
  const carriers = useOptions('/carriers/');
  const states = useOptions('/locations/states/');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setFile = (field, file) => setFiles((current) => ({ ...current, [field]: file }));

  useEffect(() => {
    if (!isEdit) return;
    trailersService.get(id)
      .then(({ data }) => {
        const next = { ...EMPTY };
        for (const key of Object.keys(EMPTY)) {
          if (key === 'is_rented') {
            next.is_rented = data.is_rented ? '1' : '0';
            continue;
          }
          const v = data[key];
          if (v === null || v === undefined) next[key] = NUMBER_FIELDS.includes(key) ? '0' : '';
          else next[key] = String(v);
        }
        setForm(next);
      })
      .catch(() => setLoadError(true));
  }, [id, isEdit]);

  const buildPayload = () => {
    const payload = {};
    for (const [k, v] of Object.entries(form)) {
      if (k === 'is_rented') continue;
      if (FK_FIELDS.includes(k) || DATE_FIELDS.includes(k)) payload[k] = v === '' ? null : v;
      else if (NUMBER_FIELDS.includes(k)) payload[k] = v === '' ? 0 : Number(v);
      else payload[k] = v;
    }
    payload.status = Number(form.status);
    payload.is_rented = form.is_rented === '1';
    return payload;
  };

  const uploadSelectedFiles = async (trailerId) => {
    const uploads = FILE_SLOTS
      .filter((slot) => files[slot])
      .map((slot) => trailersService.uploadFile(trailerId, slot, files[slot]));
    await Promise.all(uploads);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.number.trim()) errs.number = true;
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = isEdit
        ? await trailersService.update(id, payload)
        : await trailersService.create(payload);
      await uploadSelectedFiles(data.id || id);
      navigate(`/fleet/trailers/${data.id}`);
    } catch (error) {
      const responseData = error?.response?.data;
      if (responseData && typeof responseData === 'object') {
        setApiError(Object.entries(responseData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' | '));
      } else {
        setApiError('The trailer could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Trailer not found.</span>
        <Link to="/fleet/trailers" className="btn btn-sm btn-outline-secondary">Back to Trailers</Link>
      </div>
    );
  }

  const opt = (list, key = 'name') => list.map((x) => ({ value: String(x.id), label: x[key] }));

  return (
    <form className="legacy-driver-form legacy-truck-form" onSubmit={handleSubmit}>
      <div className="legacy-form-header">
        <h4>{isEdit ? 'Update Trailer' : 'Create new Trailer'}</h4>
        <Link to="/fleet/trailers" className="legacy-form-close" aria-label="Close">×</Link>
      </div>

      {apiError && <div className="alert alert-danger py-2">{apiError}</div>}

      <div className="legacy-driver-tab-body">
        <div className="row g-3">
          <Text label="Number" value={form.number} onChange={(v) => set('number', v)} required invalid={errors.number} />
          <Text label="Vin Number" value={form.vin} onChange={(v) => set('vin', v)} />

          <Text label="Year" type="number" value={form.year} onChange={(v) => set('year', v)} col="col-md-4" />
          <Text label="Width" type="number" value={form.width} onChange={(v) => set('width', v)} col="col-md-4" />
          <Text label="Height" type="number" value={form.height} onChange={(v) => set('height', v)} col="col-md-4" />

          <DateInput label="Purchase Date" value={form.purchase_date} onChange={(v) => set('purchase_date', v)} />
          <Text label="Purchase Cost" type="number" value={form.purchase_cost} onChange={(v) => set('purchase_cost', v)} />

          <FileInput label="Agreement" value={files.agreement} onChange={(file) => setFile('agreement', file)} col="col-md-12" />

          <FileInput label="Annual Inspection" value={files.annual_inspection} onChange={(file) => setFile('annual_inspection', file)} />
          <DateInput label="AI expiration date" value={form.annual_inspection_expiration} onChange={(v) => set('annual_inspection_expiration', v)} />

          <FileInput label="Registration" value={files.registration} onChange={(file) => setFile('registration', file)} col="col-md-12" />

          <Text label="Plate" value={form.plate_number} onChange={(v) => set('plate_number', v)} />
          <Select label="State" value={form.plate_state} onChange={(v) => set('plate_state', v)} options={opt(states)} />

          <Select label="Type" value={form.trailer_type} onChange={(v) => set('trailer_type', v)} options={opt(trailerTypes)} />
          <Text label="Loss Payee" value={form.loss_payee} onChange={(v) => set('loss_payee', v)} />

          <Select
            label="Rent"
            value={form.is_rented}
            onChange={(v) => set('is_rented', v)}
            includeBlank={false}
            options={[{ value: '0', label: 'NOT' }, { value: '1', label: 'YES' }]}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => set('status', v)}
            includeBlank={false}
            options={[{ value: '1', label: 'ACTIVE' }, { value: '0', label: 'INACTIVE' }]}
          />
        </div>

        <hr className="my-4" />
        <div className="fw-semibold mb-2"><i className="bi bi-building me-2" />Carrier Assignment</div>
        <div className="row g-3">
          <Select label="Owner" value={form.owner} onChange={(v) => set('owner', v)} options={opt(owners, 'full_name')} col="col-md-4" />
          <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={opt(carriers)} col="col-md-4" />
          <div className="col-md-4" />
          <DateInput label="Carrier Start" value={form.carrier_start_date} onChange={(v) => set('carrier_start_date', v)} col="col-md-4" />
          <DateInput label="Carrier End" value={form.carrier_end_date} onChange={(v) => set('carrier_end_date', v)} col="col-md-4" />
          <Text label="Carrier End Reason" value={form.carrier_end_reason} onChange={(v) => set('carrier_end_reason', v)} col="col-md-4" />
        </div>
      </div>

      <div className="d-flex gap-2 mt-4 mb-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save' : 'Save')}
        </button>
        <Link to="/fleet/trailers" className="btn btn-outline-secondary btn-sm">Close</Link>
      </div>
    </form>
  );
}
