import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PhotoCropper from '../../components/PhotoCropper';
import { DOCUMENT_TYPES, driversService } from '../../services/drivers';
import { useOptions } from '../../hooks/useOptions';
import { mediaUrl } from '../../utils/media';

const FK_FIELDS = ['driver_type', 'license_state', 'fuel_card', 'team_driver', 'owner', 'carrier'];
const DATE_FIELDS = [
  'birth_date', 'hire_date', 'termination_date', 'license_expiration',
  'medical_card_expiration', 'mvr_expiration', 'carrier_start_date', 'carrier_end_date',
];
const NUMBER_FIELDS = [
  'miles_empty', 'miles_full', 'percent', 'insurance', 'eld', 'worker_comp',
  'factor', 'factor_fee', 'weekly_rate', 'endorsements', 'restrictions',
];
const CHOICE_FIELDS = ['status', 'contract', 'pay_vacation'];

const EMPTY = {
  first_name: '', last_name: '', driver_type: '', status: '1', phone: '', email: '',
  address: '', birth_date: '', hire_date: '', termination_date: '',
  social_security_number: '', license_number: '', license_state: '',
  license_expiration: '', medical_card_expiration: '', mvr_expiration: '',
  contract: '0', miles_empty: '0', miles_full: '0', percent: '0', weekly_rate: '0',
  insurance: '0', eld: '0', worker_comp: '0', factor: '0', factor_fee: '0',
  pay_vacation: '0',
  fuel_card: '', team_driver: '', owner: '', carrier: '', carrier_start_date: '',
  carrier_end_date: '', carrier_end_reason: '', endorsements: '0', restrictions: '0',
  on_vacation: false, eld_id: '', factoring_account_id: '',
  _currentPhoto: '',
};

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'residence', label: 'Residence' },
  { key: 'cdl', label: 'CDL' },
  { key: 'contract', label: 'Work contract' },
];

const DOCUMENT_BY_FIELD = {
  social_security: '7',
  residence_card: '4',
  license: '1',
  medical_card: '2',
  mvr: '3',
  application: '5',
  lease_agreement: '6',
};

const DOCUMENT_LABELS = Object.fromEntries(DOCUMENT_TYPES.map((type) => [type.value, type.label]));

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
      {invalid && <div className="legacy-field-error">{label} cannot be blank.</div>}
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

function DateInput({ label, value, onChange, col = 'col-md-4', placeholder = 'yyyy-mm-dd' }) {
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

export default function DriverFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({});
  const [activeTab, setActiveTab] = useState('general');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const driverTypes = useOptions('/drivers/types/');
  const carriers = useOptions('/carriers/');
  const states = useOptions('/locations/states/');
  const cards = useOptions('/fleet/cards/');
  const allDrivers = useOptions('/drivers/');
  const owners = useOptions('/fleet/owners/');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setFile = (field, file) => setFiles((current) => ({ ...current, [field]: file }));

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
      else if (CHOICE_FIELDS.includes(k)) payload[k] = Number(v);
      else payload[k] = v;
    }
    return payload;
  };

  const uploadSelectedFiles = async (driverId) => {
    if (files.photo) await driversService.uploadPhoto(driverId, files.photo);
    const uploads = Object.entries(DOCUMENT_BY_FIELD)
      .filter(([field]) => files[field])
      .map(([field, documentType]) => driversService.uploadDocument(driverId, {
        document_type: documentType,
        file: files[field],
        expiration_date: (
          documentType === '1' ? form.license_expiration
            : documentType === '2' ? form.medical_card_expiration
              : documentType === '3' ? form.mvr_expiration
                : null
        ),
      }));
    await Promise.all(uploads);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = true;
    if (!form.last_name.trim()) errs.last_name = true;
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) {
      setActiveTab('general');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = isEdit
        ? await driversService.update(id, payload)
        : await driversService.create(payload);
      await uploadSelectedFiles(data.id);
      navigate(`/drivers/${data.id}`);
    } catch (error) {
      const responseData = error?.response?.data;
      if (responseData && typeof responseData === 'object') {
        setApiError(Object.entries(responseData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' | '));
      } else {
        setApiError('The driver could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const driverTypeOptions = driverTypes.map((t) => ({ value: String(t.id), label: t.name }));
  const carrierOptions = carriers.map((c) => ({ value: String(c.id), label: c.name }));
  const stateOptions = states.map((s) => ({ value: String(s.id), label: `${s.name} (${s.abbreviation})` }));
  const cardOptions = cards.map((c) => ({ value: String(c.id), label: c.number }));
  const ownerOptions = owners.map((o) => ({ value: String(o.id), label: o.full_name }));
  const teamOptions = allDrivers
    .filter((d) => String(d.id) !== String(id))
    .map((d) => ({ value: String(d.id), label: d.full_name }));

  const selectedType = useMemo(
    () => driverTypes.find((type) => String(type.id) === String(form.driver_type)),
    [driverTypes, form.driver_type]
  );
  const selectedTypeName = (selectedType?.name || '').toLowerCase();
  const isTeamDriver = String(form.driver_type) === '5' || selectedTypeName.includes('team');
  const isSoloOrTeam = String(form.driver_type) === '4' || isTeamDriver || selectedTypeName.includes('solo');
  const showOwnerOperator = !isSoloOrTeam;
  const showMiles = String(form.contract) === '1';
  const showPercent = String(form.contract) !== '1';

  if (loadError) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Driver not found.</span>
        <Link to="/drivers" className="btn btn-sm btn-outline-secondary">Back to Drivers</Link>
      </div>
    );
  }

  return (
    <form className="legacy-driver-form" onSubmit={handleSubmit}>
      <div className="legacy-form-header">
        <h4>{isEdit ? 'Update Driver' : 'Create new Driver'}</h4>
        <Link to="/drivers" className="legacy-form-close" aria-label="Close">×</Link>
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
          <>
            <div className="row g-3">
              <Text label="First Name" value={form.first_name} onChange={(v) => set('first_name', v)} required invalid={errors.first_name} />
              <Text label="Last Name" value={form.last_name} onChange={(v) => set('last_name', v)} required invalid={errors.last_name} />
              <DateInput label="Date of birth" value={form.birth_date} onChange={(v) => set('birth_date', v)} placeholder="0000-00-00" />
              <Text label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
              <Text label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} />
              <div className="col-md-4">
                <label className="control-label">Address</label>
                <textarea className="form-control form-control-sm" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
              <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={carrierOptions} placeholder="Select a carrier" />
              <Select label="Card fuel" value={form.fuel_card} onChange={(v) => set('fuel_card', v)} options={cardOptions} />
              <Select
                label="Status"
                value={form.status}
                onChange={(v) => set('status', v)}
                options={[{ value: '1', label: 'ACTIVE' }, { value: '0', label: 'INACTIVE' }, { value: '-1', label: 'TERMINATED' }]}
              />
              <div className="col-md-6">
                <label className="control-label">Picture (Always Crop After Browse)</label>
                <div className="mt-1">
                  <PhotoCropper
                    currentPhoto={form._currentPhoto || null}
                    onCrop={(blob) => setFile('photo', blob)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'residence' && (
          <div className="row g-3">
            <Text label="Social security number" value={form.social_security_number} onChange={(v) => set('social_security_number', v)} />
            <FileInput label="Social security card" value={files.social_security} onChange={(file) => setFile('social_security', file)} />
            <FileInput label="Residence card" value={files.residence_card} onChange={(file) => setFile('residence_card', file)} />
          </div>
        )}

        {activeTab === 'cdl' && (
          <div className="row g-3">
            <Text label="License number" value={form.license_number} onChange={(v) => set('license_number', v)} />
            <Select label="License state" value={form.license_state} onChange={(v) => set('license_state', v)} options={stateOptions} />
            <FileInput label="License Card" value={files.license} onChange={(file) => setFile('license', file)} />
            <DateInput label="Licence expiration date" value={form.license_expiration} onChange={(v) => set('license_expiration', v)} placeholder="..." />
            <DateInput label="Medical card expiration date" value={form.medical_card_expiration} onChange={(v) => set('medical_card_expiration', v)} placeholder="..." />
            <FileInput label="Medical card" value={files.medical_card} onChange={(file) => setFile('medical_card', file)} />
            <DateInput label="Record expiration date" value={form.mvr_expiration} onChange={(v) => set('mvr_expiration', v)} placeholder="..." />
            <FileInput label={DOCUMENT_LABELS['3'] || 'AR/MVR/D&A'} value={files.mvr} onChange={(file) => setFile('mvr', file)} />
            <FileInput label="Application driver" value={files.application} onChange={(file) => setFile('application', file)} />
          </div>
        )}

        {activeTab === 'contract' && (
          <div className="row g-3">
            <Select label="Type" value={form.driver_type} onChange={(v) => set('driver_type', v)} options={driverTypeOptions} />
            <DateInput label="Hire date" value={form.hire_date} onChange={(v) => set('hire_date', v)} />
            <DateInput label="Termination date" value={form.termination_date} onChange={(v) => set('termination_date', v)} />
            <Select
              label="Work contract"
              value={form.contract}
              onChange={(v) => set('contract', v)}
              options={[
                { value: '0', label: 'By percent' },
                { value: '1', label: 'By miles' },
                { value: '2', label: 'By percent no expenses' },
              ]}
            />
            {showPercent && <Text label="By Percent" type="number" value={form.percent} onChange={(v) => set('percent', v)} />}
            {showMiles && (
              <>
                <Text label="Miles empty" type="number" value={form.miles_empty} onChange={(v) => set('miles_empty', v)} />
                <Text label="Miles full" type="number" value={form.miles_full} onChange={(v) => set('miles_full', v)} />
              </>
            )}
            <Select
              label="Pay vacation"
              value={form.pay_vacation}
              onChange={(v) => set('pay_vacation', v)}
              options={[{ value: '0', label: 'Yes' }, { value: '1', label: 'Not' }]}
            />
            <Text label="% Factor dispatch" type="number" value={form.factor} onChange={(v) => set('factor', v)} />
            <Text label="Insurance" type="number" value={form.insurance} onChange={(v) => set('insurance', v)} />
            <Text label="Worker comp" type="number" value={form.worker_comp} onChange={(v) => set('worker_comp', v)} />
            <Text label="Factor fee" type="number" value={form.factor_fee} onChange={(v) => set('factor_fee', v)} />
            {showOwnerOperator && <Select label="Owner" value={form.owner} onChange={(v) => set('owner', v)} options={ownerOptions} />}
            {showOwnerOperator && <Text label="ELD" type="number" value={form.eld} onChange={(v) => set('eld', v)} />}
            {isTeamDriver && <Select label="Team driver" value={form.team_driver} onChange={(v) => set('team_driver', v)} options={teamOptions} />}
            {showOwnerOperator && <FileInput label="Lease agreement" value={files.lease_agreement} onChange={(file) => setFile('lease_agreement', file)} />}
          </div>
        )}
      </div>

      <div className="legacy-form-footer">
        <Link to="/drivers" className="btn btn-success btn-sm">Close</Link>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
