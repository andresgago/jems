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
  number: '', vin: '', year: '', trailer_type: '', status: '1',
  width: '0', height: '0',
  plate_number: '', plate_state: '',
  annual_inspection_expiration: '',
  purchase_date: '', purchase_cost: '0',
  is_rented: false, loss_payee: '',
  owner: '', carrier: '',
  carrier_start_date: '', carrier_end_date: '', carrier_end_reason: '',
};

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

function Text({ label, value, onChange, required, invalid, type = 'text', col = 'col-md-4' }) {
  return (
    <div className={col}>
      <label className="control-label">{label}{required && <span className="text-danger"> *</span>}</label>
      <input
        type={type}
        className={`form-control form-control-sm ${invalid ? 'is-invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, col = 'col-md-4', placeholder = '—' }) {
  return (
    <div className={col}>
      <label className="control-label">{label}</label>
      <select className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Check({ label, value, onChange }) {
  return (
    <div className="col-md-4 d-flex align-items-end">
      <div className="form-check">
        <input className="form-check-input" type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <label className="form-check-label">{label}</label>
      </div>
    </div>
  );
}

export default function TrailerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const trailerTypes = useOptions('/fleet/trailer-types/');
  const owners = useOptions('/fleet/owners/');
  const carriers = useOptions('/carriers/');
  const states = useOptions('/locations/states/');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    if (!isEdit) return;
    trailersService.get(id)
      .then(({ data }) => {
        const next = { ...EMPTY };
        for (const key of Object.keys(EMPTY)) {
          const v = data[key];
          if (typeof EMPTY[key] === 'boolean') next[key] = Boolean(v);
          else if (v === null || v === undefined) next[key] = NUMBER_FIELDS.includes(key) ? '0' : '';
          else next[key] = String(v);
        }
        setForm(next);
      })
      .catch(() => setLoadError(true));
  }, [id, isEdit]);

  const buildPayload = () => {
    const payload = {};
    for (const [k, v] of Object.entries(form)) {
      if (FK_FIELDS.includes(k) || DATE_FIELDS.includes(k)) payload[k] = v === '' ? null : v;
      else if (NUMBER_FIELDS.includes(k)) payload[k] = v === '' ? 0 : Number(v);
      else payload[k] = v;
    }
    payload.status = Number(form.status);
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.number.trim()) errs.number = true;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = isEdit
        ? await trailersService.update(id, payload)
        : await trailersService.create(payload);
      navigate(`/fleet/trailers/${data.id}`);
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
    <form onSubmit={handleSubmit}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-truck-flatbed me-2" />{isEdit ? 'Edit Trailer' : 'New Trailer'}</h5>
        <Link to="/fleet/trailers" className="btn btn-sm btn-outline-secondary">Cancel</Link>
      </div>

      <Section title="Identity" icon="bi-card-heading">
        <Text label="Number" value={form.number} onChange={(v) => set('number', v)} required invalid={errors.number} />
        <Text label="VIN" value={form.vin} onChange={(v) => set('vin', v)} />
        <Text label="Year" type="number" value={form.year} onChange={(v) => set('year', v)} />
        <Select label="Type" value={form.trailer_type} onChange={(v) => set('trailer_type', v)} options={opt(trailerTypes)} />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          options={[{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }]}
        />
        <Text label="Width (ft)" type="number" value={form.width} onChange={(v) => set('width', v)} />
        <Text label="Height (ft)" type="number" value={form.height} onChange={(v) => set('height', v)} />
      </Section>

      <Section title="Plate" icon="bi-credit-card-2-front">
        <Text label="Plate Number" value={form.plate_number} onChange={(v) => set('plate_number', v)} />
        <Select label="Plate State" value={form.plate_state} onChange={(v) => set('plate_state', v)} options={opt(states)} />
      </Section>

      <Section title="Compliance" icon="bi-shield-check">
        <Text label="AI Expiration" type="date" value={form.annual_inspection_expiration} onChange={(v) => set('annual_inspection_expiration', v)} />
      </Section>

      <Section title="Purchase" icon="bi-cash-stack">
        <Text label="Purchase Date" type="date" value={form.purchase_date} onChange={(v) => set('purchase_date', v)} />
        <Text label="Purchase Cost" type="number" value={form.purchase_cost} onChange={(v) => set('purchase_cost', v)} />
        <Check label="Rented" value={form.is_rented} onChange={(v) => set('is_rented', v)} />
        <Text label="Loss Payee" value={form.loss_payee} onChange={(v) => set('loss_payee', v)} col="col-md-8" />
      </Section>

      <Section title="Carrier Assignment" icon="bi-building">
        <Select label="Owner" value={form.owner} onChange={(v) => set('owner', v)} options={opt(owners, 'full_name')} />
        <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={opt(carriers)} />
        <Text label="Carrier Start" type="date" value={form.carrier_start_date} onChange={(v) => set('carrier_start_date', v)} />
        <Text label="Carrier End" type="date" value={form.carrier_end_date} onChange={(v) => set('carrier_end_date', v)} />
        <div className="col-md-8">
          <label className="control-label">End Reason</label>
          <textarea className="form-control form-control-sm" rows={2} value={form.carrier_end_reason} onChange={(e) => set('carrier_end_reason', e.target.value)} />
        </div>
      </Section>

      <div className="d-flex gap-2 mb-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Trailer')}
        </button>
        <Link to="/fleet/trailers" className="btn btn-outline-secondary btn-sm">Cancel</Link>
      </div>
    </form>
  );
}
