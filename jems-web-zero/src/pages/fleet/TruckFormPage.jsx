import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import PhotoCropper from '../../components/PhotoCropper';
import { trucksService } from '../../services/trucks';
import { useOptions } from '../../hooks/useOptions';
import { mediaUrl } from '../../utils/media';

const FK_FIELDS = [
  'truck_type', 'make', 'engine_type', 'cabin_type', 'transmission_type',
  'tire_size', 'dispatcher', 'owner', 'fuel_card', 'carrier', 'loss_payee',
];
const DATE_FIELDS = [
  'avi_expiration', 'registration_expiration', 'purchase_date',
  'carrier_start_date', 'carrier_end_date',
];
const NUMBER_FIELDS = ['year', 'gross_weight', 'purchase_cost', 'odometer_start', 'odometer_current'];

const EMPTY = {
  number: '', vin: '', year: '', truck_type: '', status: '1', plate: '',
  transponder: '', make: '', engine_type: '', cabin_type: '',
  transmission_type: '', tire_size: '', gross_weight: '', odometer_start: '0', odometer_current: '',
  avi_expiration: '', registration_expiration: '', purchase_date: '',
  purchase_cost: '0', is_leased: true, leased_name: '', loan_term: '',
  interest_rate: '', monthly_bill: '0', remaining_balance: '0', dispatcher: '',
  owner: '', fuel_card: '', carrier: '', carrier_start_date: '',
  carrier_end_date: '', carrier_end_reason: '', loss_payee: '', mac_address: '',
  serial_number: '', eld_company: '', eld_id: '', factoring_account_id: '',
  _currentPhoto: '',
};

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'registration', label: 'Registration' },
  { key: 'owner', label: 'Owner' },
];

const FILE_SLOTS = {
  photo: 'photo',
  avi: 'avi',
  registration: 'registration',
  agreement: 'agreement',
  leased: 'leased',
};

function Text({ label, value, onChange, required, invalid, type = 'text', col = 'col-md-4', placeholder = '' }) {
  return (
    <div className={col}>
      <label className={`control-label ${invalid ? 'text-danger' : ''}`}>{label}{required && <span className="text-danger"> *</span>}</label>
      <input
        type={type}
        className={`form-control form-control-sm ${invalid ? 'is-invalid' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid === true && <div className="legacy-field-error">{label} cannot be blank.</div>}
      {typeof invalid === 'string' && <div className="legacy-field-error">{invalid}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options, col = 'col-md-4', placeholder = '...' }) {
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

function DateInput({ label, value, onChange, col = 'col-md-4', placeholder = '...' }) {
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
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function FileInput({ label, value, onChange, col = 'col-md-4' }) {
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

export default function TruckFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({});
  const initialTab = TABS.some((tab) => tab.key === searchParams.get('tab')) ? searchParams.get('tab') : 'general';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const truckTypes = useOptions('/fleet/truck-types/');
  const makes = useOptions('/fleet/makes/');
  const engineTypes = useOptions('/fleet/engine-types/');
  const cabinTypes = useOptions('/fleet/cabin-types/');
  const transmissionTypes = useOptions('/fleet/transmission-types/');
  const tireSizes = useOptions('/fleet/tire-sizes/');
  const owners = useOptions('/fleet/owners/');
  const carriers = useOptions('/carriers/');
  const lossPayees = useOptions('/fleet/loss-payees/');
  const users = useOptions('/users/');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setFile = (field, file) => setFiles((current) => ({ ...current, [field]: file }));

  useEffect(() => {
    if (!isEdit) return;
    trucksService.get(id)
      .then(({ data }) => {
        const next = { ...EMPTY };
        for (const key of Object.keys(EMPTY)) {
          const v = data[key];
          if (key.startsWith('_')) continue;
          if (typeof EMPTY[key] === 'boolean') next[key] = Boolean(v);
          else if (v === null || v === undefined) next[key] = NUMBER_FIELDS.includes(key) ? '0' : '';
          else next[key] = String(v);
        }
        next._currentPhoto = mediaUrl(data.photo) || '';
        setForm(next);
      })
      .catch(() => setLoadError(true));
  }, [id, isEdit]);

  const buildPayload = () => {
    const payload = {};
    for (const [k, v] of Object.entries(form)) {
      if (k.startsWith('_')) continue;
      if (FK_FIELDS.includes(k) || DATE_FIELDS.includes(k)) payload[k] = v === '' ? null : v;
      else if (NUMBER_FIELDS.includes(k)) payload[k] = v === '' ? 0 : Number(v);
      else payload[k] = v;
    }
    payload.status = Number(form.status);
    return payload;
  };

  const uploadSelectedFiles = async (truckId) => {
    const uploads = Object.entries(FILE_SLOTS)
      .filter(([field]) => files[field])
      .map(([field, slot]) => trucksService.uploadFile(truckId, slot, files[field]));
    await Promise.all(uploads);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.number.trim()) errs.number = true;
    if (form.is_leased && !form.owner) errs.owner = 'Owner cannot be blank.';
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) {
      setActiveTab(errs.owner && !errs.number ? 'owner' : 'general');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = isEdit
        ? await trucksService.update(id, payload)
        : await trucksService.create(payload);
      await uploadSelectedFiles(data.id || id);
      navigate(`/fleet/trucks/${data.id}`);
    } catch (error) {
      const responseData = error?.response?.data;
      if (responseData && typeof responseData === 'object') {
        setApiError(Object.entries(responseData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' | '));
      } else {
        setApiError('The truck could not be saved.');
      }
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
  const ownerOptions = opt(owners, 'full_name');
  const isLeased = Boolean(form.is_leased);

  return (
    <form className="legacy-driver-form legacy-truck-form" onSubmit={handleSubmit}>
      <div className="legacy-form-header">
        <h4>{isEdit ? 'Update Truck' : 'Create new Truck'}</h4>
        <Link to="/fleet/trucks" className="legacy-form-close" aria-label="Close">×</Link>
      </div>

      <ul className="nav nav-tabs legacy-driver-tabs">
        {TABS.map((tab) => (
          <li className="nav-item" key={tab.key}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {apiError && <div className="alert alert-danger py-2">{apiError}</div>}

      <div className="legacy-driver-tab-body">
        {activeTab === 'general' && (
          <div className="row g-3">
            <Text label="Number" value={form.number} onChange={(v) => set('number', v)} required invalid={errors.number} />
            <Text label="Vin number" value={form.vin} onChange={(v) => set('vin', v)} />
            <Text label="Mac" value={form.mac_address} onChange={(v) => set('mac_address', v)} />
            <Text label="Plate" value={form.plate} onChange={(v) => set('plate', v)} col="col-md-3" />
            <Text label="Transponder" value={form.transponder} onChange={(v) => set('transponder', v)} col="col-md-3" />
            <Text label="Odometer" type="number" value={form.odometer_current} onChange={(v) => set('odometer_current', v)} col="col-md-3" />
            <Text label="Serial Num" value={form.serial_number} onChange={(v) => set('serial_number', v)} col="col-md-3" />
            <Text label="Year" type="number" value={form.year} onChange={(v) => set('year', v)} col="col-md-3" placeholder="..." />
            <Select label="Type" value={form.truck_type} onChange={(v) => set('truck_type', v)} options={opt(truckTypes)} col="col-md-3" />
            <Select label="Make" value={form.make} onChange={(v) => set('make', v)} options={opt(makes)} col="col-md-3" />
            <Select label="Model" value={form.cabin_type} onChange={(v) => set('cabin_type', v)} options={opt(cabinTypes)} col="col-md-3" />
            <Select label="Engine" value={form.engine_type} onChange={(v) => set('engine_type', v)} options={opt(engineTypes)} col="col-md-3" />
            <Select label="Transmission" value={form.transmission_type} onChange={(v) => set('transmission_type', v)} options={opt(transmissionTypes)} col="col-md-3" />
            <Select label="Tires size" value={form.tire_size} onChange={(v) => set('tire_size', v)} options={opt(tireSizes)} col="col-md-3" />
            <Text label="Gross weight" type="number" value={form.gross_weight} onChange={(v) => set('gross_weight', v)} col="col-md-3" />
            <Select label="Dispatcher" value={form.dispatcher} onChange={(v) => set('dispatcher', v)} options={opt(users, 'full_name')} col="col-md-4" placeholder="Select a Dispatcher" />
            <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={opt(carriers)} col="col-md-4" placeholder="Select a carrier" />
            <Select
              label="Status"
              value={form.status}
              onChange={(v) => set('status', v)}
              col="col-md-4"
              options={[{ value: '1', label: 'ACTIVE' }, { value: '0', label: 'INACTIVE' }]}
            />
            <div className="col-md-5">
              <label className="control-label">Picture (Always crop after browse)</label>
              <div className="mt-1">
                <PhotoCropper
                  currentPhoto={form._currentPhoto || null}
                  onCrop={(blob) => setFile('photo', blob)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'purchase' && (
          <div className="row g-3">
            <DateInput label="Purchase date" value={form.purchase_date} onChange={(v) => set('purchase_date', v)} col="col-md-3" />
            <Text label="Purchase cost ($)" type="number" value={form.purchase_cost} onChange={(v) => set('purchase_cost', v)} col="col-md-3" />
            <Select label="Loss payee" value={form.loss_payee} onChange={(v) => set('loss_payee', v)} options={opt(lossPayees)} col="col-md-3" placeholder="No loss payee" />
            <FileInput label="Contract" value={files.agreement} onChange={(file) => setFile('agreement', file)} col="col-md-3" />
            <Text label="Loan Term" value={form.loan_term} onChange={(v) => set('loan_term', v)} col="col-md-3" placeholder="No loan term" />
            <Text label="Interest rate (%)" value={form.interest_rate} onChange={(v) => set('interest_rate', v)} col="col-md-3" />
            <Text label="Monthly bill ($)" value={form.monthly_bill} onChange={(v) => set('monthly_bill', v)} col="col-md-3" />
            <Text label="Remaining balance ($)" value={form.remaining_balance} onChange={(v) => set('remaining_balance', v)} col="col-md-3" />
          </div>
        )}

        {activeTab === 'registration' && (
          <div className="legacy-truck-document-rows">
            <div className="row g-3 legacy-truck-document-row">
              <FileInput label="AVI" value={files.avi} onChange={(file) => setFile('avi', file)} col="col-md-6" />
              <DateInput label="AVI expiration date" value={form.avi_expiration} onChange={(v) => set('avi_expiration', v)} col="col-md-6" />
            </div>
            <div className="row g-3 legacy-truck-document-row">
              <FileInput label="Registration" value={files.registration} onChange={(file) => setFile('registration', file)} col="col-md-6" />
              <DateInput label="Registration expiration date" value={form.registration_expiration} onChange={(v) => set('registration_expiration', v)} col="col-md-6" />
            </div>
          </div>
        )}

        {activeTab === 'owner' && (
          <div className="row g-3">
            <Select
              label="Company owns"
              value={isLeased ? '1' : '0'}
              onChange={(v) => set('is_leased', v === '1')}
              options={[{ value: '1', label: 'LEASED' }, { value: '0', label: 'OWNER' }]}
              col="col-md-4"
            />
            <Select
              label="Owner"
              value={form.owner}
              onChange={(v) => set('owner', v)}
              options={ownerOptions}
              col="col-md-4"
              invalid={errors.owner}
            />
            {isLeased && <FileInput label="Leased agreement" value={files.leased} onChange={(file) => setFile('leased', file)} col="col-md-4" />}
            {ownerOptions.length === 0 && (
              <div className="col-12 small text-muted">
                No truck owners found. <Link to="/settings/truck-owners">Create a Truck Owner</Link>
              </div>
            )}
            {errors.owner && <div className="col-12 legacy-field-error">{errors.owner}</div>}
          </div>
        )}
      </div>

      <div className="legacy-form-footer">
        <Link to="/fleet/trucks" className="btn btn-success btn-sm">Close</Link>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
