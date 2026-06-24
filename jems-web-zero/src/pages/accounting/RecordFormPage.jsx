import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { recordsService, RECORD_TYPE } from '../../services/accounting';
import { useOptions } from '../../hooks/useOptions';

const INITIAL = {
  date: new Date().toISOString().slice(0, 10),
  account: '',
  quantity: '1',
  amount: '',
  detail: '',
  record_type: '2',
  load: '',
  truck: '',
  trailer: '',
  driver: '',
  team_driver: '',
  owner: '',
  category: '',
  category_expire: false,
  category_expire_date: '',
  dispatcher: '',
  city: '',
  card: '',
  carrier: '',
  product: '',
  transaction_number: '',
};

const FK_FIELDS = ['account', 'load', 'truck', 'trailer', 'driver', 'team_driver', 'owner', 'category', 'dispatcher', 'city', 'card', 'carrier'];
const DATE_FIELDS = ['category_expire_date'];
const NUMBER_FIELDS = ['quantity', 'amount', 'record_type'];

export default function RecordFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const accounts = useOptions('/accounts/');
  const categories = useOptions('/categories/');
  const drivers = useOptions('/drivers/options/');
  const trucks = useOptions('/fleet/trucks/options/');
  const trailers = useOptions('/fleet/trailers/options/');
  const carriers = useOptions('/carriers/');
  const cards = useOptions('/fleet/cards/');

  useEffect(() => {
    if (!isEdit) return;
    recordsService.get(id).then((r) => {
      const d = r.data;
      setForm({
        date: d.date || '',
        account: d.account != null ? String(d.account) : '',
        quantity: d.quantity != null ? String(d.quantity) : '1',
        amount: d.amount != null ? String(d.amount) : '',
        detail: d.detail || '',
        record_type: d.record_type != null ? String(d.record_type) : '2',
        load: d.load != null ? String(d.load) : '',
        truck: d.truck != null ? String(d.truck) : '',
        trailer: d.trailer != null ? String(d.trailer) : '',
        driver: d.driver != null ? String(d.driver) : '',
        team_driver: d.team_driver != null ? String(d.team_driver) : '',
        owner: d.owner != null ? String(d.owner) : '',
        category: d.category != null ? String(d.category) : '',
        category_expire: Boolean(d.category_expire),
        category_expire_date: d.category_expire_date || '',
        dispatcher: d.dispatcher != null ? String(d.dispatcher) : '',
        city: d.city != null ? String(d.city) : '',
        card: d.card != null ? String(d.card) : '',
        carrier: d.carrier != null ? String(d.carrier) : '',
        product: d.product || '',
        transaction_number: d.transaction_number || '',
      });
    });
  }, [id, isEdit]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const buildPayload = () => {
    const payload = { ...form };
    for (const f of FK_FIELDS) {
      payload[f] = payload[f] !== '' ? Number(payload[f]) : null;
    }
    for (const f of DATE_FIELDS) {
      payload[f] = payload[f] !== '' ? payload[f] : null;
    }
    for (const f of NUMBER_FIELDS) {
      if (payload[f] !== '' && payload[f] != null) payload[f] = Number(payload[f]);
    }
    return payload;
  };

  const validate = () => {
    const errs = {};
    if (!form.date) errs.date = 'Date is required.';
    if (!form.account) errs.account = 'Account is required.';
    if (form.amount === '' || form.amount == null) errs.amount = 'Amount is required.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await recordsService.update(id, payload);
        navigate(`/accounting/records/${id}`);
      } else {
        const { data } = await recordsService.create(payload);
        navigate(`/accounting/records/${data.id}`);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        setErrors(data);
      } else {
        setErrors({ non_field_errors: 'Failed to save record.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center mb-3 gap-2">
        <Link to="/accounting/records" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left" />
        </Link>
        <h5 className="mb-0">
          <i className="bi bi-journal-text me-2" />
          {isEdit ? 'Edit Record' : 'New Record'}
        </h5>
      </div>

      {errors.non_field_errors && (
        <div className="alert alert-danger">{errors.non_field_errors}</div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Core */}
        <div className="card mb-3">
          <div className="card-header py-2 fw-semibold">
            <i className="bi bi-info-circle me-2" />General
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className={`form-control${errors.date ? ' is-invalid' : ''}`}
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  required
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label">Account <span className="text-danger">*</span></label>
                <select
                  className={`form-select${errors.account ? ' is-invalid' : ''}`}
                  value={form.account}
                  onChange={(e) => set('account', e.target.value)}
                  required
                >
                  <option value="">— select —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                  ))}
                </select>
                {errors.account && <div className="invalid-feedback">{errors.account}</div>}
              </div>

              <div className="col-md-2">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={form.record_type}
                  onChange={(e) => set('record_type', e.target.value)}
                >
                  {Object.entries(RECORD_TYPE).map(([v, t]) => (
                    <option key={v} value={v}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">Amount <span className="text-danger">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  className={`form-control${errors.amount ? ' is-invalid' : ''}`}
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  required
                />
                {errors.amount && <div className="invalid-feedback">{errors.amount}</div>}
              </div>

              <div className="col-md-2">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  step="0.001"
                  className="form-control"
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Detail</label>
                <textarea
                  className="form-control"
                  rows={2}
                  maxLength={500}
                  value={form.detail}
                  onChange={(e) => set('detail', e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Product</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength={100}
                  value={form.product}
                  onChange={(e) => set('product', e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Transaction #</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength={100}
                  value={form.transaction_number}
                  onChange={(e) => set('transaction_number', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Linked Entities */}
        <div className="card mb-3">
          <div className="card-header py-2 fw-semibold">
            <i className="bi bi-link-45deg me-2" />Linked Entities
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Driver</label>
                <select className="form-select" value={form.driver} onChange={(e) => set('driver', e.target.value)}>
                  <option value="">—</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name || `${d.first_name} ${d.last_name}`}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Team Driver</label>
                <select className="form-select" value={form.team_driver} onChange={(e) => set('team_driver', e.target.value)}>
                  <option value="">—</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name || `${d.first_name} ${d.last_name}`}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Truck</label>
                <select className="form-select" value={form.truck} onChange={(e) => set('truck', e.target.value)}>
                  <option value="">—</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>{t.number}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Trailer</label>
                <select className="form-select" value={form.trailer} onChange={(e) => set('trailer', e.target.value)}>
                  <option value="">—</option>
                  {trailers.map((t) => (
                    <option key={t.id} value={t.id}>{t.number}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Load #</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Load ID"
                  value={form.load}
                  onChange={(e) => set('load', e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">Carrier</label>
                <select className="form-select" value={form.carrier} onChange={(e) => set('carrier', e.target.value)}>
                  <option value="">—</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Card</label>
                <select className="form-select" value={form.card} onChange={(e) => set('card', e.target.value)}>
                  <option value="">—</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.number}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="card mb-3">
          <div className="card-header py-2 fw-semibold">
            <i className="bi bi-tag me-2" />Category
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-2 d-flex align-items-end">
                <div className="form-check mb-1">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="category_expire"
                    checked={form.category_expire}
                    onChange={(e) => set('category_expire', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="category_expire">Has Expiry</label>
                </div>
              </div>

              {form.category_expire && (
                <div className="col-md-3">
                  <label className="form-label">Category Expiry Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.category_expire_date}
                    onChange={(e) => set('category_expire_date', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Record'}
          </button>
          <Link to="/accounting/records" className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
