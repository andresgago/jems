import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

const EMPTY = { carrier_id: '', driver_id: '', truck_id: '', trailer_id: '', broker_email: '' };

export default function SendDriverInfoModal({ onClose }) {
  const [carriers, setCarriers] = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [trucks, setTrucks]     = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const emailRef = useRef();

  useEffect(() => {
    Promise.all([
      api.get('/carriers/'),
      api.get('/drivers/'),
    ]).then(([cRes, dRes]) => {
      setCarriers(cRes.data.results ?? cRes.data);
      setDrivers(dRes.data.results ?? dRes.data);
    });
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleDriverChange(e) {
    const driverId = e.target.value;
    set('driver_id', driverId);
    set('truck_id', '');
    set('trailer_id', '');
    setTrucks([]);
    setTrailers([]);

    if (!driverId) return;
    const res = await api.get(`/drivers/${driverId}/last-vehicle/`);
    const { trucks: t, trailers: tr, last_truck_id, last_trailer_id } = res.data;
    setTrucks(t);
    setTrailers(tr);
    set('truck_id', last_truck_id ?? (t[0]?.id ?? ''));
    set('trailer_id', last_trailer_id ?? (tr[0]?.id ?? ''));
  }

  async function handleSend() {
    setError('');
    setSending(true);
    try {
      await api.post('/loads/send-driver-info/', form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Error sending email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Send driver information</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            {success ? (
              <p className="text-success mb-0">Driver information sent successfully!</p>
            ) : (
              <>
                {error && <div className="alert alert-danger py-2">{error}</div>}

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Carrier</label>
                    <select className="form-select" value={form.carrier_id} onChange={e => set('carrier_id', e.target.value)}>
                      <option value="">Select a carrier</option>
                      {carriers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Driver</label>
                    <select className="form-select" value={form.driver_id} onChange={handleDriverChange}>
                      <option value="">Select driver</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Last used truck</label>
                    <select className="form-select" value={form.truck_id} onChange={e => set('truck_id', e.target.value)} disabled={!trucks.length}>
                      <option value="">Select truck</option>
                      {trucks.map(t => (
                        <option key={t.id} value={t.id}>{t.number} — {t.vin}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Last used trailer</label>
                    <select className="form-select" value={form.trailer_id} onChange={e => set('trailer_id', e.target.value)} disabled={!trailers.length}>
                      <option value="">Select trailer</option>
                      {trailers.map(t => (
                        <option key={t.id} value={t.id}>{t.number} — {t.vin} — {t.trailer_type__name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">To</label>
                    <input ref={emailRef} type="email" className="form-control" value={form.broker_email} onChange={e => set('broker_email', e.target.value)} placeholder="broker@example.com" />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">In reply to</label>
                    <select className="form-select" disabled>
                      <option>...</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            {!success && (
              <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
