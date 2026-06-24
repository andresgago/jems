import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dispatchWorkService, dispatchersService } from '../../services/dispatch';

const FK_FIELDS = ['dispatcher', 'invoice_percent', 'invoice_hour'];

function buildPayload(form) {
  const payload = { ...form };
  FK_FIELDS.forEach((f) => {
    payload[f] = form[f] ? Number(form[f]) : null;
  });
  if (!payload.start) payload.start = null;
  if (!payload.end) payload.end = null;
  return payload;
}

export default function DispatchWorkFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [dispatchers, setDispatchers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    dispatcher: '',
    start: '',
    end: '',
    session: '',
    invoice_percent: '',
    invoice_hour: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatchersService.options().then(({ data }) => setDispatchers(data));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    dispatchWorkService.get(id).then(({ data }) => {
      setForm({
        title: data.title || '',
        dispatcher: data.dispatcher ?? '',
        start: data.start ? data.start.slice(0, 16) : '',
        end: data.end ? data.end.slice(0, 16) : '',
        session: data.session || '',
        invoice_percent: data.invoice_percent ?? '',
        invoice_hour: data.invoice_hour ?? '',
      });
    });
  }, [id, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!form.title.trim()) { setErrors({ title: 'Required.' }); return; }
    if (!form.start) { setErrors({ start: 'Required.' }); return; }
    if (!form.end) { setErrors({ end: 'Required.' }); return; }

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEdit) {
        await dispatchWorkService.update(id, payload);
      } else {
        await dispatchWorkService.create(payload);
      }
      navigate('/dispatch/calendar');
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else setErrors({ non_field_errors: 'Save failed. Check fields.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link to="/dispatch/calendar" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left" />
        </Link>
        <h5 className="mb-0">
          <i className="bi bi-calendar3 me-2" />
          {isEdit ? 'Edit Work Session' : 'New Work Session'}
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
                <label className="form-label">Title <span className="text-danger">*</span></label>
                <input
                  className={`form-control ${errors.title ? 'is-invalid' : ''}`}
                  value={form.title}
                  onChange={set('title')}
                  maxLength={100}
                />
                {errors.title && <div className="invalid-feedback">{errors.title}</div>}
              </div>

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
                <label className="form-label">Start <span className="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  className={`form-control ${errors.start ? 'is-invalid' : ''}`}
                  value={form.start}
                  onChange={set('start')}
                />
                {errors.start && <div className="invalid-feedback">{errors.start}</div>}
              </div>

              <div className="col-md-6">
                <label className="form-label">End <span className="text-danger">*</span></label>
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
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Session'}
                </button>
                <Link to="/dispatch/calendar" className="btn btn-outline-secondary">Cancel</Link>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
