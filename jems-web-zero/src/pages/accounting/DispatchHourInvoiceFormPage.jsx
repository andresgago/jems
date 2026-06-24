import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { hourInvoicesService, dispatchersService } from '../../services/dispatch';

const FK_FIELDS = ['dispatcher', 'record'];
const NUMBER_FIELDS = ['pay_per_hour'];

function buildPayload(form) {
  const payload = { ...form };
  FK_FIELDS.forEach((f) => { payload[f] = form[f] ? Number(form[f]) : null; });
  NUMBER_FIELDS.forEach((f) => { payload[f] = form[f] !== '' ? Number(form[f]) : null; });
  if (!payload.date) payload.date = null;
  if (!payload.start) payload.start = null;
  if (!payload.end) payload.end = null;
  return payload;
}

export default function DispatchHourInvoiceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [dispatchers, setDispatchers] = useState([]);
  const [form, setForm] = useState({
    dispatcher: '',
    date: '',
    start: '',
    end: '',
    pay_per_hour: '',
    record: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatchersService.options().then(({ data }) => setDispatchers(data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    hourInvoicesService.get(id).then(({ data }) => {
      setForm({
        dispatcher: data.dispatcher ?? '',
        date: data.date || '',
        start: data.start ? data.start.slice(0, 16) : '',
        end: data.end ? data.end.slice(0, 16) : '',
        pay_per_hour: data.pay_per_hour ?? '',
        record: data.record ?? '',
      });
    });
  }, [id, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!form.date) { setErrors({ date: 'Required.' }); return; }
    if (!form.start) { setErrors({ start: 'Required.' }); return; }
    if (!form.end) { setErrors({ end: 'Required.' }); return; }
    if (form.pay_per_hour === '') { setErrors({ pay_per_hour: 'Required.' }); return; }

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEdit) {
        await hourInvoicesService.update(id, payload);
        navigate(`/accounting/invoices/dispatchers-hour/${id}`);
      } else {
        const { data } = await hourInvoicesService.create(payload);
        navigate(`/accounting/invoices/dispatchers-hour/${data.id}`);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else setErrors({ non_field_errors: 'Save failed. Check fields.' });
    } finally {
      setSaving(false);
    }
  };

  const backUrl = isEdit
    ? `/accounting/invoices/dispatchers-hour/${id}`
    : '/accounting/invoices/dispatchers-hour';

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link to={backUrl} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left" />
        </Link>
        <h5 className="mb-0">
          <i className="bi bi-clock me-2" />
          {isEdit ? 'Edit Hour Invoice' : 'New Hour Invoice'}
        </h5>
      </div>

      {errors.non_field_errors && (
        <div className="alert alert-danger">{errors.non_field_errors}</div>
      )}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              <div className="col-md-6">
                <label className="form-label">Dispatcher</label>
                <select className="form-select" value={form.dispatcher} onChange={set('dispatcher')}>
                  <option value="">— Select —</option>
                  {dispatchers.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Rate per Hour ($) <span className="text-danger">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`form-control ${errors.pay_per_hour ? 'is-invalid' : ''}`}
                  value={form.pay_per_hour}
                  onChange={set('pay_per_hour')}
                />
                {errors.pay_per_hour && <div className="invalid-feedback">{errors.pay_per_hour}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label">Invoice Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className={`form-control ${errors.date ? 'is-invalid' : ''}`}
                  value={form.date}
                  onChange={set('date')}
                />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label">Period Start <span className="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  className={`form-control ${errors.start ? 'is-invalid' : ''}`}
                  value={form.start}
                  onChange={set('start')}
                />
                {errors.start && <div className="invalid-feedback">{errors.start}</div>}
              </div>

              <div className="col-md-4">
                <label className="form-label">Period End <span className="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  className={`form-control ${errors.end ? 'is-invalid' : ''}`}
                  value={form.end}
                  onChange={set('end')}
                />
                {errors.end && <div className="invalid-feedback">{errors.end}</div>}
              </div>

              <div className="col-12 d-flex gap-2 pt-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
                </button>
                <Link to={backUrl} className="btn btn-outline-secondary">Cancel</Link>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
