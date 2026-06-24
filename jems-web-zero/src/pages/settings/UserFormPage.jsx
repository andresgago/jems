import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DISPATCHER_TYPES, USER_CONTRACTS, usersService } from '../../services/users';
import { useOptions } from '../../hooks/useOptions';
import { buildUserPayload } from './userPayload';

const EMPTY = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  status: 10,
  is_dispatcher: false,
  dispatcher_type: 0,
  contract: 0,
  percent: '0',
  hours: '0',
  start_hour: '',
  end_hour: '',
  color: '#000000',
  address: '',
  social_security_number: '',
  position: '',
  main_dispatcher: '',
  carrier: '0',
  carriers_access: [],
  dispatcher_access: [],
  is_staff: false,
};

export default function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingUser, setLoadingUser] = useState(isEdit);
  const positions = useOptions('/users/positions/');
  const mainDispatchers = useOptions('/users/options/?dispatchers=1&main=1');

  useEffect(() => {
    if (!isEdit) return;
    setLoadingUser(true);
    usersService.get(id)
      .then(({ data }) => {
        setForm({
          ...EMPTY,
          ...data,
          password: '',
          position: data.position ?? '',
          main_dispatcher: data.main_dispatcher ?? '',
          percent: String(data.percent ?? 0),
          hours: String(data.hours ?? 0),
          carrier: String(data.carrier ?? 0),
          start_hour: data.start_hour || '',
          end_hour: data.end_hour || '',
        });
      })
      .finally(() => setLoadingUser(false));
  }, [id, isEdit]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username is required.';
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    if (!isEdit && form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (Number(form.percent) < 0 || Number(form.percent) > 100) e.percent = 'Percent must be between 0 and 100.';
    if (Number(form.hours) < 0) e.hours = 'Hours must be greater than or equal to 0.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    setErrors({});
    try {
      const payload = buildUserPayload(form, isEdit);
      if (isEdit) {
        await usersService.update(id, payload);
        navigate(`/settings/users/${id}`);
      } else {
        const { data } = await usersService.create(payload);
        navigate(`/settings/users/${data.id}`);
      }
    } catch (err) {
      const data = err?.response?.data;
      setErrors(data && typeof data === 'object' ? data : { non_field_errors: 'An error occurred. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div>
      <div className="mb-3">
        <Link to="/settings/users" className="text-decoration-none text-muted small">
          <i className="bi bi-arrow-left me-1" />Users
        </Link>
        <h4 className="mb-0 mt-1">{isEdit ? 'Edit User' : 'Create User'}</h4>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {errors.non_field_errors && <div className="alert alert-danger">{String(errors.non_field_errors)}</div>}

        <div className="card mb-3">
          <div className="card-header py-2 bg-light"><span className="fw-semibold"><i className="bi bi-person me-2" />Profile</span></div>
          <div className="card-body">
            <div className="row g-3">
              <Input label="Username" required value={form.username} error={errors.username} disabled={isEdit} onChange={set('username')} />
              <Input label="First Name" required value={form.first_name} error={errors.first_name} onChange={set('first_name')} />
              <Input label="Last Name" required value={form.last_name} error={errors.last_name} onChange={set('last_name')} />
              <Input label="Email" required type="email" value={form.email} error={errors.email} onChange={set('email')} />
              <Input label="Phone" value={form.phone} onChange={set('phone')} />
              {!isEdit && <Input label="Password" required type="password" value={form.password} error={errors.password} onChange={set('password')} />}
              <Select label="Status" value={form.status} onChange={set('status')} options={[{ id: 10, label: 'Active' }, { id: 0, label: 'Inactive' }]} />
              <Input label="Address" value={form.address} onChange={set('address')} />
              <Input label="SSN" value={form.social_security_number} onChange={set('social_security_number')} />
              <Select label="Position" value={form.position} onChange={set('position')} options={positions.map((p) => ({ id: p.id, label: p.name }))} empty="— None —" />
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light"><span className="fw-semibold"><i className="bi bi-calendar-week me-2" />Dispatcher</span></div>
          <div className="card-body">
            <div className="row g-3">
              <Check label="Dispatcher" value={form.is_dispatcher} onChange={set('is_dispatcher')} />
              <Select label="Dispatcher Type" value={form.dispatcher_type} onChange={set('dispatcher_type')} options={Object.entries(DISPATCHER_TYPES).map(([id, label]) => ({ id, label }))} />
              <Select label="Contract" value={form.contract} onChange={set('contract')} options={Object.entries(USER_CONTRACTS).map(([id, label]) => ({ id, label }))} />
              <Select label="Main Dispatcher" value={form.main_dispatcher} onChange={set('main_dispatcher')} options={mainDispatchers.map((u) => ({ id: u.id, label: u.label }))} empty="— None —" />
              <Input label="Percent" type="number" value={form.percent} error={errors.percent} onChange={set('percent')} />
              <Input label="Hours" type="number" value={form.hours} error={errors.hours} onChange={set('hours')} />
              <Input label="Start Hour" type="time" value={form.start_hour} onChange={set('start_hour')} />
              <Input label="End Hour" type="time" value={form.end_hour} onChange={set('end_hour')} />
              <Input label="Color" type="color" value={form.color} onChange={set('color')} />
              <Check label="Staff" value={form.is_staff} onChange={set('is_staff')} />
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-primary" disabled={saving} type="submit">
            {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
          <Link to={isEdit ? `/settings/users/${id}` : '/settings/users'} className="btn btn-sm btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, error, required = false, type = 'text', disabled = false }) {
  return (
    <div className="col-md-4">
      <label className="control-label">{label} {required && <span className="text-danger">*</span>}</label>
      <input type={type} className={`form-control form-control-sm ${error ? 'is-invalid' : ''}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      {error && <div className="invalid-feedback">{Array.isArray(error) ? error.join(' ') : String(error)}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options, empty }) {
  return (
    <div className="col-md-4">
      <label className="control-label">{label}</label>
      <select className="form-select form-select-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {empty && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Check({ label, value, onChange }) {
  return (
    <div className="col-md-4 d-flex align-items-end">
      <label className="d-flex align-items-center gap-2 mb-0">
        <input type="checkbox" className="form-check-input mt-0" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    </div>
  );
}
