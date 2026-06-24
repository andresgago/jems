import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trucksService } from '../../services/trucks';
import { useOptions } from '../../hooks/useOptions';

const FK_FIELDS = [
  'truck_type', 'make', 'engine_type', 'cabin_type', 'transmission_type',
  'tire_size', 'dispatcher', 'owner', 'fuel_card', 'carrier', 'loss_payee',
];
const DATE_FIELDS = [
  'avi_expiration', 'registration_expiration', 'purchase_date',
  'carrier_start_date', 'carrier_end_date',
];
const NUMBER_FIELDS = ['year', 'gross_weight', 'purchase_cost', 'odometer_current'];

const EMPTY = {
  number: '', vin: '', year: '', truck_type: '', status: '1', plate: '',
  transponder: '', make: '', engine_type: '', cabin_type: '',
  transmission_type: '', tire_size: '', gross_weight: '0', odometer_current: '0',
  avi_expiration: '', registration_expiration: '', purchase_date: '',
  purchase_cost: '0', is_leased: false, leased_name: '', loan_term: '',
  interest_rate: '', monthly_bill: '', remaining_balance: '', dispatcher: '',
  owner: '', fuel_card: '', carrier: '', carrier_start_date: '',
  carrier_end_date: '', carrier_end_reason: '', loss_payee: '', mac_address: '',
  serial_number: '', eld_company: '',
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

export default function TruckFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const truckTypes = useOptions('/fleet/truck-types/');
  const makes = useOptions('/fleet/makes/');
  const engineTypes = useOptions('/fleet/engine-types/');
  const cabinTypes = useOptions('/fleet/cabin-types/');
  const transmissionTypes = useOptions('/fleet/transmission-types/');
  const tireSizes = useOptions('/fleet/tire-sizes/');
  const owners = useOptions('/fleet/owners/');
  const cards = useOptions('/fleet/cards/');
  const carriers = useOptions('/carriers/');
  const lossPayees = useOptions('/fleet/loss-payees/');
  const users = useOptions('/users/');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    if (!isEdit) return;
    trucksService.get(id)
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
        ? await trucksService.update(id, payload)
        : await trucksService.create(payload);
      navigate(`/fleet/trucks/${data.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Truck not found.</span>
        <Link to="/fleet/trucks" className="btn btn-sm btn-outline-secondary">Back to Trucks</Link>
      </div>
    );
  }

  const opt = (list, key = 'name') => list.map((x) => ({ value: String(x.id), label: x[key] }));

  return (
    <form onSubmit={handleSubmit}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-truck me-2" />{isEdit ? 'Edit Truck' : 'New Truck'}</h5>
        <Link to="/fleet/trucks" className="btn btn-sm btn-outline-secondary">Cancel</Link>
      </div>

      <Section title="Identity" icon="bi-card-heading">
        <Text label="Number" value={form.number} onChange={(v) => set('number', v)} required invalid={errors.number} />
        <Text label="VIN" value={form.vin} onChange={(v) => set('vin', v)} />
        <Text label="Year" type="number" value={form.year} onChange={(v) => set('year', v)} />
        <Select label="Type" value={form.truck_type} onChange={(v) => set('truck_type', v)} options={opt(truckTypes)} />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          placeholder="Active"
          options={[{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }]}
        />
        <Text label="Plate" value={form.plate} onChange={(v) => set('plate', v)} />
        <Text label="Transponder" value={form.transponder} onChange={(v) => set('transponder', v)} />
      </Section>

      <Section title="Specs" icon="bi-gear">
        <Select label="Make" value={form.make} onChange={(v) => set('make', v)} options={opt(makes)} />
        <Select label="Engine" value={form.engine_type} onChange={(v) => set('engine_type', v)} options={opt(engineTypes)} />
        <Select label="Cabin / Model" value={form.cabin_type} onChange={(v) => set('cabin_type', v)} options={opt(cabinTypes)} />
        <Select label="Transmission" value={form.transmission_type} onChange={(v) => set('transmission_type', v)} options={opt(transmissionTypes)} />
        <Select label="Tire Size" value={form.tire_size} onChange={(v) => set('tire_size', v)} options={opt(tireSizes)} />
        <Text label="Gross Weight" type="number" value={form.gross_weight} onChange={(v) => set('gross_weight', v)} />
        <Text label="Odometer" type="number" value={form.odometer_current} onChange={(v) => set('odometer_current', v)} />
      </Section>

      <Section title="Compliance" icon="bi-shield-check">
        <Text label="AVI Expiration" type="date" value={form.avi_expiration} onChange={(v) => set('avi_expiration', v)} />
        <Text label="Registration Expiration" type="date" value={form.registration_expiration} onChange={(v) => set('registration_expiration', v)} />
      </Section>

      <Section title="Purchase & Financing" icon="bi-cash-stack">
        <Text label="Purchase Date" type="date" value={form.purchase_date} onChange={(v) => set('purchase_date', v)} />
        <Text label="Purchase Cost" type="number" value={form.purchase_cost} onChange={(v) => set('purchase_cost', v)} />
        <Check label="Leased" value={form.is_leased} onChange={(v) => set('is_leased', v)} />
        <Text label="Leased Name" value={form.leased_name} onChange={(v) => set('leased_name', v)} />
        <Text label="Loan Term" value={form.loan_term} onChange={(v) => set('loan_term', v)} />
        <Text label="Interest Rate" value={form.interest_rate} onChange={(v) => set('interest_rate', v)} />
        <Text label="Monthly Bill" value={form.monthly_bill} onChange={(v) => set('monthly_bill', v)} />
        <Text label="Remaining Balance" value={form.remaining_balance} onChange={(v) => set('remaining_balance', v)} />
        <Select label="Loss Payee" value={form.loss_payee} onChange={(v) => set('loss_payee', v)} options={opt(lossPayees)} />
      </Section>

      <Section title="Assignments" icon="bi-link-45deg">
        <Select label="Dispatcher" value={form.dispatcher} onChange={(v) => set('dispatcher', v)} options={opt(users, 'full_name')} />
        <Select label="Owner" value={form.owner} onChange={(v) => set('owner', v)} options={opt(owners, 'full_name')} />
        <Select label="Fuel Card" value={form.fuel_card} onChange={(v) => set('fuel_card', v)} options={opt(cards, 'number')} />
        <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={opt(carriers)} />
        <Text label="Carrier Start" type="date" value={form.carrier_start_date} onChange={(v) => set('carrier_start_date', v)} />
        <Text label="Carrier End" type="date" value={form.carrier_end_date} onChange={(v) => set('carrier_end_date', v)} />
        <div className="col-md-8">
          <label className="control-label">Carrier End Reason</label>
          <textarea className="form-control form-control-sm" rows={2} value={form.carrier_end_reason} onChange={(e) => set('carrier_end_reason', e.target.value)} />
        </div>
      </Section>

      <Section title="ELD" icon="bi-broadcast">
        <Text label="MAC Address" value={form.mac_address} onChange={(v) => set('mac_address', v)} />
        <Text label="Serial Number" value={form.serial_number} onChange={(v) => set('serial_number', v)} />
        <Text label="ELD Company" value={form.eld_company} onChange={(v) => set('eld_company', v)} />
      </Section>

      <div className="d-flex gap-2 mb-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Truck')}
        </button>
        <Link to="/fleet/trucks" className="btn btn-outline-secondary btn-sm">Cancel</Link>
      </div>
    </form>
  );
}
