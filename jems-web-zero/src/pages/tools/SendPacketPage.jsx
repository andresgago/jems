import { useEffect, useState } from 'react';
import { carriersService } from '../../services/carriers';

const EMPTY_FORM = { carrier_id: '', broker_email: '' };

export default function SendPacketPage() {
  const [carriers, setCarriers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    carriersService.list().then((res) => {
      setCarriers(res.data.results ?? res.data);
    });
  }, []);

  async function handleCarrierChange(e) {
    const id = e.target.value;
    setForm((f) => ({ ...f, carrier_id: id }));
    setAvailableFiles([]);
    setSelectedSlots([]);
    setError('');
    setSuccess(false);

    if (!id) return;
    setFilesLoading(true);
    try {
      const res = await carriersService.availableFiles(id);
      setAvailableFiles(res.data);
    } catch {
      setError('Could not load carrier files.');
    } finally {
      setFilesLoading(false);
    }
  }

  function toggleSlot(slot) {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  }

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await carriersService.sendPacket(form.carrier_id, {
        broker_email: form.broker_email,
        file_slots: selectedSlots,
      });
      setSuccess(true);
      setForm(EMPTY_FORM);
      setAvailableFiles([]);
      setSelectedSlots([]);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to send packet.');
    } finally {
      setSending(false);
    }
  }

  const canSend =
    form.carrier_id &&
    form.broker_email.trim() &&
    selectedSlots.length > 0 &&
    !sending;

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-4">Send Carrier Packet</h4>

      {success && (
        <div className="alert alert-success" role="alert">
          Packet sent successfully!
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="row g-3" style={{ maxWidth: 700 }}>
        <div className="col-md-7">
          <label className="form-label">Carrier</label>
          <select
            className="form-select"
            value={form.carrier_id}
            onChange={handleCarrierChange}
            required
          >
            <option value="">Select carrier…</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-5">
          <label className="form-label">Broker email</label>
          <input
            type="email"
            className="form-control"
            placeholder="broker@example.com"
            value={form.broker_email}
            onChange={(e) => setForm((f) => ({ ...f, broker_email: e.target.value }))}
            required
          />
        </div>

        <div className="col-12">
          <label className="form-label">Packet files</label>
          {filesLoading && <p className="text-muted small mb-0">Loading files…</p>}
          {!filesLoading && form.carrier_id && availableFiles.length === 0 && (
            <p className="text-muted small mb-0">No files uploaded for this carrier.</p>
          )}
          {!filesLoading && availableFiles.length > 0 && (
            <div className="d-flex flex-wrap gap-3">
              {availableFiles.map(({ slot, label }) => (
                <div key={slot} className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`slot-${slot}`}
                    checked={selectedSlots.includes(slot)}
                    onChange={() => toggleSlot(slot)}
                  />
                  <label className="form-check-label" htmlFor={`slot-${slot}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-12">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canSend}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
