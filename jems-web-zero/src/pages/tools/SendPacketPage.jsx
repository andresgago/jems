import { useEffect, useState } from 'react';
import { brokersService } from '../../services/brokers';
import { carriersService } from '../../services/carriers';

const EMPTY_FORM = { carrier_id: '', broker_id: '', broker_email: '' };

function packetErrorMessage(err) {
  const payload = err.response?.data?.error;
  if (!payload) return 'Failed to send packet.';
  if (typeof payload === 'string') return payload;
  return Object.entries(payload)
    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
    .join(' ');
}

export default function SendPacketPage() {
  const [carriers, setCarriers] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [brokerContacts, setBrokerContacts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([carriersService.options(), brokersService.options()]).then(([carrierRes, brokerRes]) => {
      setCarriers(carrierRes.data);
      setBrokers(brokerRes.data);
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

  async function handleBrokerChange(e) {
    const id = e.target.value;
    setForm((f) => ({ ...f, broker_id: id }));
    setBrokerContacts([]);
    setSelectedContactIds([]);
    setError('');
    setSuccess(false);

    if (!id) return;
    setContactsLoading(true);
    try {
      const res = await brokersService.getContacts(id);
      setBrokerContacts(res.data);
    } catch {
      setError('Could not load broker contacts.');
    } finally {
      setContactsLoading(false);
    }
  }

  function toggleSlot(slot) {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  }

  function toggleContact(contact) {
    const contactId = String(contact.id);
    const isSelected = selectedContactIds.includes(contactId);
    let next = isSelected
      ? selectedContactIds.filter((id) => id !== contactId)
      : [...selectedContactIds, contactId];

    if (!isSelected && contact.team) {
      const teamIds = brokerContacts
        .filter((item) => item.team)
        .map((item) => String(item.id));
      next = Array.from(new Set([...next, ...teamIds]));
    }

    setSelectedContactIds(next);
  }

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await carriersService.sendPacket(form.carrier_id, {
        broker_email: form.broker_email,
        broker_id: form.broker_id ? Number(form.broker_id) : null,
        contact_ids: selectedContactIds.map((id) => Number(id)),
        file_slots: selectedSlots,
      });
      setSuccess(true);
      setForm(EMPTY_FORM);
      setAvailableFiles([]);
      setBrokerContacts([]);
      setSelectedSlots([]);
      setSelectedContactIds([]);
    } catch (err) {
      setError(packetErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const canSend =
    form.carrier_id &&
    (form.broker_email.trim() || selectedContactIds.length > 0) &&
    selectedSlots.length > 0 &&
    !sending;

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-4">Send Carrier Packet</h4>

      {success && (
        <div className="alert alert-success" role="alert">
          Packet was sent successfully!
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="row g-3" style={{ maxWidth: 980 }}>
        <div className="col-md-6">
          <label className="form-label" htmlFor="send-packet-carrier">Carrier</label>
          <select
            id="send-packet-carrier"
            className="form-select"
            value={form.carrier_id}
            onChange={handleCarrierChange}
            required
          >
            <option value="">Select carrier…</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="send-packet-broker">Broker</label>
          <select
            id="send-packet-broker"
            className="form-select"
            value={form.broker_id}
            onChange={handleBrokerChange}
          >
            <option value="">Select broker…</option>
            {brokers.map((broker) => (
              <option key={broker.id} value={broker.id}>
                {broker.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label">Broker contacts</label>
          <div className="border rounded bg-white p-2" style={{ minHeight: 44 }}>
            {!form.broker_id && (
              <p className="text-muted small mb-0">Select a broker first.</p>
            )}
            {contactsLoading && (
              <p className="text-muted small mb-0">Loading contacts…</p>
            )}
            {form.broker_id && !contactsLoading && brokerContacts.length === 0 && (
              <p className="text-muted small mb-0">No contacts found for this broker.</p>
            )}
            {!contactsLoading && brokerContacts.length > 0 && (
              <div className="d-grid gap-2">
                {brokerContacts.map((contact) => {
                  const contactId = String(contact.id);
                  return (
                    <label key={contact.id} className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={selectedContactIds.includes(contactId)}
                        onChange={() => toggleContact(contact)}
                      />
                      <span className="form-check-label">
                        {contact.name}{' '}
                        <span className="text-muted">({contact.email})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <label className="form-label" htmlFor="send-packet-email">Additional email</label>
          <input
            id="send-packet-email"
            type="email"
            className="form-control"
            placeholder="broker@example.com"
            maxLength={50}
            value={form.broker_email}
            onChange={(e) => setForm((f) => ({ ...f, broker_email: e.target.value }))}
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
