import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { driversService } from '../../services/drivers';
import { useOptions } from '../../hooks/useOptions';

const FK_FIELDS = ['driver_type', 'license_state', 'fuel_card', 'team_driver', 'carrier'];
const DATE_FIELDS = [
  'birth_date', 'hire_date', 'termination_date', 'license_expiration',
  'medical_card_expiration', 'mvr_expiration', 'carrier_start_date', 'carrier_end_date',
];
const NUMBER_FIELDS = [
  'miles_empty', 'miles_full', 'percent', 'insurance', 'eld', 'worker_comp',
  'factor', 'factor_fee', 'endorsements', 'restrictions',
];

const EMPTY = {
  first_name: '', last_name: '', driver_type: '', status: '1', phone: '', email: '',
  address: '', birth_date: '', hire_date: '', termination_date: '',
  social_security_number: '', license_number: '', license_state: '',
  license_expiration: '', medical_card_expiration: '', mvr_expiration: '',
  contract: false, miles_empty: '0', miles_full: '0', percent: '0',
  insurance: '0', eld: '0', worker_comp: '0', factor: '0', factor_fee: '0',
  fuel_card: '', team_driver: '', carrier: '', carrier_start_date: '',
  carrier_end_date: '', carrier_end_reason: '', endorsements: '0', restrictions: '0',
  on_vacation: false,
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

export default function DriverFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const driverTypes = useOptions('/drivers/types/');
  const carriers = useOptions('/carriers/');
  const states = useOptions('/locations/states/');
  const cards = useOptions('/fleet/cards/');
  const allDrivers = useOptions('/drivers/');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    if (!isEdit) return;
    driversService.get(id)
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
    if (!form.first_name.trim()) errs.first_name = true;
    if (!form.last_name.trim()) errs.last_name = true;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = isEdit
        ? await driversService.update(id, payload)
        : await driversService.create(payload);
      navigate(`/drivers/${data.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Driver not found.</span>
        <Link to="/drivers" className="btn btn-sm btn-outline-secondary">Back to Drivers</Link>
      </div>
    );
  }

  const driverTypeOptions = driverTypes.map((t) => ({ value: String(t.id), label: t.name }));
  const carrierOptions = carriers.map((c) => ({ value: String(c.id), label: c.name }));
  const stateOptions = states.map((s) => ({ value: String(s.id), label: `${s.name} (${s.abbreviation})` }));
  const cardOptions = cards.map((c) => ({ value: String(c.id), label: c.number }));
  const teamOptions = allDrivers
    .filter((d) => String(d.id) !== String(id))
    .map((d) => ({ value: String(d.id), label: d.full_name }));

  return (
    <form onSubmit={handleSubmit}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-person-plus me-2" />{isEdit ? 'Edit Driver' : 'New Driver'}
        </h5>
        <Link to="/drivers" className="btn btn-sm btn-outline-secondary">Cancel</Link>
      </div>

      <Section title="Personal" icon="bi-person-vcard">
        <Text label="First Name" value={form.first_name} onChange={(v) => set('first_name', v)} required invalid={errors.first_name} />
        <Text label="Last Name" value={form.last_name} onChange={(v) => set('last_name', v)} required invalid={errors.last_name} />
        <Select label="Driver Type" value={form.driver_type} onChange={(v) => set('driver_type', v)} options={driverTypeOptions} />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          placeholder="Active"
          options={[{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }, { value: '-1', label: 'Terminated' }]}
        />
        <Text label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
        <Text label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} />
        <Text label="Address" col="col-md-8" value={form.address} onChange={(v) => set('address', v)} />
        <Text label="Birth Date" type="date" value={form.birth_date} onChange={(v) => set('birth_date', v)} />
        <Text label="SSN" value={form.social_security_number} onChange={(v) => set('social_security_number', v)} />
      </Section>

      <Section title="Employment" icon="bi-briefcase">
        <Text label="Hire Date" type="date" value={form.hire_date} onChange={(v) => set('hire_date', v)} />
        <Text label="Termination Date" type="date" value={form.termination_date} onChange={(v) => set('termination_date', v)} />
        <Check label="Contract" value={form.contract} onChange={(v) => set('contract', v)} />
        <Check label="On Vacation" value={form.on_vacation} onChange={(v) => set('on_vacation', v)} />
      </Section>

      <Section title="License & Medical" icon="bi-card-heading">
        <Text label="License Number" value={form.license_number} onChange={(v) => set('license_number', v)} />
        <Select label="License State" value={form.license_state} onChange={(v) => set('license_state', v)} options={stateOptions} />
        <Text label="License Expiration" type="date" value={form.license_expiration} onChange={(v) => set('license_expiration', v)} />
        <Text label="Medical Card Expiration" type="date" value={form.medical_card_expiration} onChange={(v) => set('medical_card_expiration', v)} />
        <Text label="MVR Expiration" type="date" value={form.mvr_expiration} onChange={(v) => set('mvr_expiration', v)} />
      </Section>

      <Section title="Carrier" icon="bi-truck-front">
        <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={carrierOptions} />
        <Text label="Start Date" type="date" value={form.carrier_start_date} onChange={(v) => set('carrier_start_date', v)} />
        <Text label="End Date" type="date" value={form.carrier_end_date} onChange={(v) => set('carrier_end_date', v)} />
        <div className="col-md-8">
          <label className="control-label">End Reason</label>
          <textarea className="form-control form-control-sm" rows={2} value={form.carrier_end_reason} onChange={(e) => set('carrier_end_reason', e.target.value)} />
        </div>
      </Section>

      <Section title="Compensation" icon="bi-cash-stack">
        <Text label="Miles (Empty)" type="number" value={form.miles_empty} onChange={(v) => set('miles_empty', v)} />
        <Text label="Miles (Full)" type="number" value={form.miles_full} onChange={(v) => set('miles_full', v)} />
        <Text label="Percent" type="number" value={form.percent} onChange={(v) => set('percent', v)} />
      </Section>

      <Section title="Deductions" icon="bi-dash-circle">
        <Text label="Insurance" type="number" value={form.insurance} onChange={(v) => set('insurance', v)} />
        <Text label="ELD" type="number" value={form.eld} onChange={(v) => set('eld', v)} />
        <Text label="Worker Comp" type="number" value={form.worker_comp} onChange={(v) => set('worker_comp', v)} />
        <Text label="Factor" type="number" value={form.factor} onChange={(v) => set('factor', v)} />
        <Text label="Factor Fee" type="number" value={form.factor_fee} onChange={(v) => set('factor_fee', v)} />
      </Section>

      <Section title="Assignments & CDL" icon="bi-link-45deg">
        <Select label="Fuel Card" value={form.fuel_card} onChange={(v) => set('fuel_card', v)} options={cardOptions} />
        <Select label="Team Driver" value={form.team_driver} onChange={(v) => set('team_driver', v)} options={teamOptions} />
        <Text label="Endorsements" type="number" value={form.endorsements} onChange={(v) => set('endorsements', v)} />
        <Text label="Restrictions" type="number" value={form.restrictions} onChange={(v) => set('restrictions', v)} />
      </Section>

      <div className="d-flex gap-2 mb-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Driver')}
        </button>
        <Link to="/drivers" className="btn btn-outline-secondary btn-sm">Cancel</Link>
      </div>
    </form>
  );
}
