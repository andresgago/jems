import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadsService } from '../../services/loads';
import { useOptions } from '../../hooks/useOptions';
import api from '../../services/api';
import { loadGoogleMaps, parsePlaceComponents, calculateMiles } from '../../services/googleMaps';
import DateTimePicker from '../../components/DateTimePicker';
import { utcIsoToEtDisplay } from '../../utils/dates';

const LUMPER_PAID_BY = [
  { value: '', label: '—' },
  { value: 'company', label: 'Company' },
  { value: 'broker', label: 'Broker' },
  { value: 'driver', label: 'Driver' },
];

/* ── Generic async search input (mirrors TMS Select2 AJAX) ── */
function BusinessCreateRow({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/brokers/business/', { name: name.trim() });
      onSave(data);
    } catch (e) {
      setError(e.response?.data?.name?.[0] || 'Could not create business.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded p-2 mt-1 bg-light">
      <div className="input-group input-group-sm">
        <input
          autoFocus
          className="form-control"
          placeholder="Business name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? '…' : 'Save'}
        </button>
        <button className="btn btn-outline-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}

function AsyncSearch({ label, placeholder = 'Type to search...', value, displayValue, onSearch, onSelect, onClear, required = false, isInvalid = false, labelAddon = null }) {
  const [query, setQuery] = useState(displayValue || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => { setQuery(displayValue || ''); }, [displayValue]);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const data = await onSearch(q);
      setResults(data);
      setOpen(true);
    }, 250);
  };

  const pick = (item) => {
    onSelect(item);
    setQuery(item.label);
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onClear();
    setQuery('');
    setResults([]);
  };

  return (
    <div>
      {label && (
        <label className="control-label d-flex align-items-center gap-1">
          {label}{required && <span className="text-danger">*</span>}
          {labelAddon}
        </label>
      )}
      <div className="position-relative">
        <div className="input-group input-group-sm">
          <input
            type="text"
            className={`form-control${isInvalid ? ' is-invalid' : ''}`}
            placeholder={placeholder}
            value={query}
            onChange={handleChange}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoComplete="off"
          />
          {value && (
            <button className="btn btn-outline-secondary" type="button" onClick={clear} tabIndex={-1}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>
        {open && results.length > 0 && (
          <ul className="list-group position-absolute w-100 shadow" style={{ zIndex: 1050, maxHeight: 220, overflowY: 'auto' }}>
            {results.map(r => (
              <li
                key={r.id}
                className="list-group-item list-group-item-action py-1 small"
                style={{ cursor: 'pointer' }}
                onMouseDown={() => pick(r)}
              >
                {r.label}
                {r.sublabel && <span className="text-muted ms-1">{r.sublabel}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BrokerContactsSelect({ brokerId, contacts, loading, value, onChange, onContactCreated }) {
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '' });
  const [creatingContact, setCreatingContact] = useState(false);
  const [createError, setCreateError] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState(null);
  const listRef = useRef(null);
  const selectedIds = csvToIds(value);

  useEffect(() => {
    if (!lastCreatedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-contact-id="${lastCreatedId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setLastCreatedId(null);
    }
  }, [contacts, lastCreatedId]);

  const toggleContact = (contact) => {
    const contactId = String(contact.id);
    const isSelected = selectedIds.includes(contactId);
    let next = isSelected
      ? selectedIds.filter((id) => id !== contactId)
      : [...selectedIds, contactId];

    if (!isSelected && contact?.team) {
      const teamIds = contacts
        .filter((item) => item.team === contact.team)
        .map((item) => String(item.id));
      next = Array.from(new Set([...next, ...teamIds]));
    }

    onChange(next.join(','));
  };

  const handleCreateContact = async () => {
    if (!brokerId || !newContact.name || !newContact.email || !newContact.phone) return;
    setCreatingContact(true);
    setCreateError('');
    try {
      const { data } = await api.post(`/brokers/${brokerId}/contacts/`, newContact);
      await onContactCreated(data);
      setLastCreatedId(data.id);
      setNewContact({ name: '', email: '', phone: '' });
      setShowNewContact(false);
    } catch (error) {
      const response = error.response?.data;
      setCreateError(response ? JSON.stringify(response) : 'Could not create contact.');
    } finally {
      setCreatingContact(false);
    }
  };

  return (
    <div>
      <label className="control-label d-flex align-items-center gap-1">
        Broker Contacts
        <button
          type="button"
          className="btn btn-default btn-xs border py-0 px-1"
          title="Create new contact"
          aria-label="Create new contact"
          disabled={!brokerId}
          onClick={() => setShowNewContact((current) => !current)}
        >
          <i className="bi bi-plus" />
        </button>
      </label>
      {showNewContact && (
        <div className="border rounded p-2 mb-2 bg-light">
          <div className="row g-2">
            <div className="col-md-4">
              <input
                className="form-control form-control-sm"
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <input
                className="form-control form-control-sm"
                placeholder="Email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <div className="input-group input-group-sm">
                <input
                  className="form-control"
                  placeholder="Phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  aria-label="Add broker contact"
                  disabled={creatingContact || !newContact.name || !newContact.email || !newContact.phone}
                  onClick={handleCreateContact}
                >
                  <i className="bi bi-check" />
                </button>
              </div>
            </div>
          </div>
          {createError && <div className="text-danger small mt-1">{createError}</div>}
        </div>
      )}
      <div className="broker-contacts-list border rounded bg-white" ref={listRef}>
        {contacts.map((contact) => {
          const contactId = String(contact.id);
          return (
            <label className="broker-contact-option" key={contact.id} data-contact-id={contact.id}>
              <input
                className="form-check-input"
                type="checkbox"
                checked={selectedIds.includes(contactId)}
                disabled={!brokerId || loading}
                onChange={() => toggleContact(contact)}
              />
              <span>
                {contact.name} <span className="text-muted">({contact.email})</span>
              </span>
            </label>
          );
        })}
      </div>
      {!brokerId && <div className="form-text">Select a broker first.</div>}
      {brokerId && loading && <div className="form-text">Loading contacts...</div>}
      {brokerId && !loading && contacts.length === 0 && (
        <div className="form-text">No contacts found for this broker.</div>
      )}
    </div>
  );
}

function csvToIds(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const EMPTY = {
  number: '', weight: 42000, payment: '',
  detention: 0, lumper: 0, lumper_paid_by: '', drop_trailer: 0,
  miles: 0, miles_empty: 0,
  pickup_date: '', pickup_address: '', pickup_city: null,
  dropoff_date: '', dropoff_address: '', dropoff_city: null,
  broker: null, broker_contacts: '',
  trailer_type: null, carrier: null,
  shipper: null, receiver: null,
  details: '',
};

const EMPTY_DISPLAY = {
  broker: '', pickup_city: '', dropoff_city: '', shipper: '', receiver: '', carrier: '',
};

export default function LoadFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY);
  const [display, setDisplay] = useState(EMPTY_DISPLAY);
  const [errors, setErrors] = useState({});
  const [brokerContacts, setBrokerContacts] = useState([]);
  const [loadingBrokerContacts, setLoadingBrokerContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [showNewShipper, setShowNewShipper] = useState(false);
  const [showNewReceiver, setShowNewReceiver] = useState(false);

  const trailerTypes = useOptions('/fleet/trailer-types/');
  const carriers = useOptions('/carriers/');

  const pickupAddressRef = useRef(null);
  const dropoffAddressRef = useRef(null);
  const pickupLatLng = useRef(null);
  const dropoffLatLng = useRef(null);

  useEffect(() => {
    if (loadingData) return;

    let cancelled = false;

    const findCity = async ({ zip, cityName, state }) => {
      if (zip) {
        const { data } = await api.get('/loads/cities/search/', { params: { q: zip } }).catch(() => ({ data: [] }));
        const match = state ? data.find(c => c.state === state) : data[0];
        if (match) return match;
      }
      if (cityName) {
        const { data } = await api.get('/loads/cities/search/', { params: { q: cityName } }).catch(() => ({ data: [] }));
        const match = state ? data.find(c => c.state === state) : data[0];
        if (match) return match;
      }
      return null;
    };

    loadGoogleMaps().then(() => {
      if (cancelled) return;
      const options = {
        fields: ['address_components', 'geometry'],
        componentRestrictions: { country: 'us' },
      };

      const pickupAC = new window.google.maps.places.Autocomplete(pickupAddressRef.current, options);
      pickupAC.addListener('place_changed', async () => {
        const place = pickupAC.getPlace();
        if (!place.geometry) return;
        const components = parsePlaceComponents(place);
        if (components.street) set('pickup_address', components.street);
        pickupLatLng.current = place.geometry.location;
        const city = await findCity(components);
        if (city) {
          setForm(f => ({ ...f, pickup_city: city.id }));
          setDisp('pickup_city', `${city.name}, ${city.state}`);
        }
        if (dropoffLatLng.current) {
          const miles = await calculateMiles(pickupLatLng.current, dropoffLatLng.current);
          if (miles) set('miles', miles);
        }
      });

      const dropoffAC = new window.google.maps.places.Autocomplete(dropoffAddressRef.current, options);
      dropoffAC.addListener('place_changed', async () => {
        const place = dropoffAC.getPlace();
        if (!place.geometry) return;
        const components = parsePlaceComponents(place);
        if (components.street) set('dropoff_address', components.street);
        dropoffLatLng.current = place.geometry.location;
        const city = await findCity(components);
        if (city) {
          setForm(f => ({ ...f, dropoff_city: city.id }));
          setDisp('dropoff_city', `${city.name}, ${city.state}`);
        }
        if (pickupLatLng.current) {
          const miles = await calculateMiles(pickupLatLng.current, dropoffLatLng.current);
          if (miles) set('miles', miles);
        }
      });
    });
    return () => { cancelled = true; };
  }, [loadingData]);

  const loadBrokerContacts = async (brokerId) => {
    if (!brokerId) {
      setBrokerContacts([]);
      return [];
    }

    setLoadingBrokerContacts(true);
    try {
      const { data } = await api.get(`/brokers/${brokerId}/contacts/`);
      setBrokerContacts(data);
      return data;
    } catch {
      setBrokerContacts([]);
      return [];
    } finally {
      setLoadingBrokerContacts(false);
    }
  };

  useEffect(() => {
    if (!isEdit) return;
    loadsService.get(id).then(({ data }) => {
      setForm({
        number: data.number || '', weight: data.weight || 0,
        payment: data.payment || '', detention: data.detention || 0,
        lumper: data.lumper || 0, lumper_paid_by: data.lumper_paid_by || '',
        drop_trailer: data.drop_trailer || 0, miles: data.miles || 0,
        miles_empty: data.miles_empty || 0,
        pickup_date: utcIsoToEtDisplay(data.pickup_date), pickup_address: data.pickup_address || '',
        pickup_city: data.pickup_city || null,
        dropoff_date: utcIsoToEtDisplay(data.dropoff_date), dropoff_address: data.dropoff_address || '',
        dropoff_city: data.dropoff_city || null,
        broker: data.broker || null, broker_contacts: data.broker_contacts || '',
        trailer_type: data.trailer_type || null, carrier: data.carrier || null,
        shipper: data.shipper || null, receiver: data.receiver || null,
        details: data.details || '',
      });
      setDisplay({
        broker: data.broker_name || '',
        pickup_city: data.pickup_city_display || '',
        dropoff_city: data.dropoff_city_display || '',
        shipper: data.shipper_name || '',
        receiver: data.receiver_name || '',
        carrier: data.carrier_name || '',
      });
      setLoadingData(false);
    });
  }, [id, isEdit]);

  useEffect(() => {
    if (!form.broker) {
      setBrokerContacts([]);
      return;
    }

    let cancelled = false;
    setLoadingBrokerContacts(true);
    api.get(`/brokers/${form.broker}/contacts/`)
      .then(({ data }) => {
        if (!cancelled) setBrokerContacts(data);
      })
      .catch(() => {
        if (!cancelled) setBrokerContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBrokerContacts(false);
      });

    return () => { cancelled = true; };
  }, [form.broker]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const setDisp = (field, value) => setDisplay(d => ({ ...d, [field]: value }));

  const searchCities = async (q) => {
    const { data } = await api.get('/loads/cities/search/', { params: { q } });
    return data.map(c => ({ id: c.id, label: `${c.name}, ${c.state}`, sublabel: c.zip }));
  };

  const searchBrokers = async (q) => {
    const { data } = await api.get('/brokers/search/', { params: { q } });
    return data.map(b => ({ id: b.id, label: b.dba_name || b.name }));
  };

  const searchBusiness = async (q) => {
    const { data } = await api.get('/brokers/business/search/', { params: { q } }).catch(() => ({ data: [] }));
    return data.map(b => ({ id: b.id, label: b.name, sublabel: b.city_display || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        await loadsService.update(id, form);
        navigate(`/loads/${id}`);
      } else {
        const { data } = await loadsService.create(form);
        navigate(`/loads/${data.id}`);
      }
    } catch (err) {
      if (err.response?.data) setErrors(err.response.data);
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  const err = (field) => errors[field] && (
    <div className="text-danger small mt-1">{Array.isArray(errors[field]) ? errors[field].join(', ') : errors[field]}</div>
  );

  return (
    <div className="load-form">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-box-seam me-2" />
          {isEdit ? `Edit Load #${form.number}` : 'New Load'}
        </h5>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => navigate('/loads')}>
          <i className="bi bi-arrow-left me-1" />Back
        </button>
      </div>

      <form onSubmit={handleSubmit} autoComplete="on">

        {/* Row 1: Carrier | Number | Weight | Payment */}
        <div className="row mb-3">
          <div className="col-md-3">
            <label className="control-label">Carrier <span className="text-danger">*</span></label>
            <select
              className={`form-select form-select-sm ${errors.carrier ? 'is-invalid' : ''}`}
              value={form.carrier || ''}
              onChange={e => set('carrier', e.target.value || null)}
              required
            >
              <option value="">— Select —</option>
              {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {err('carrier')}
          </div>
          <div className="col-md-3">
            <label className="control-label">Load Number <span className="text-danger">*</span></label>
            <input
              type="text"
              className={`form-control form-control-sm ${errors.number ? 'is-invalid' : ''}`}
              value={form.number}
              onChange={e => set('number', e.target.value)}
              autoFocus required
            />
            {err('number')}
          </div>
          <div className="col-md-3">
            <label className="control-label">Weight (lbs) <span className="text-danger">*</span></label>
            <input type="number" className="form-control form-control-sm" value={form.weight}
              onChange={e => set('weight', parseFloat(e.target.value) || 0)} required />
          </div>
          <div className="col-md-3">
            <label className="control-label">Payment ($) <span className="text-danger">*</span></label>
            <input type="number" step="0.01" className={`form-control form-control-sm ${errors.payment ? 'is-invalid' : ''}`}
              value={form.payment} onChange={e => set('payment', e.target.value)} required />
            {err('payment')}
          </div>
        </div>

        {/* Row 2: Trailer Type | Broker | Broker Contacts */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="control-label">Trailer Type <span className="text-danger">*</span></label>
            <select className="form-select form-select-sm" value={form.trailer_type || ''} onChange={e => set('trailer_type', e.target.value || null)} required>
              <option value="">— Select —</option>
              {trailerTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.short_name})</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <AsyncSearch
              label="Broker"
              placeholder="Type 3+ chars to search..."
              value={form.broker}
              displayValue={display.broker}
              onSearch={searchBrokers}
              onSelect={item => { set('broker', item.id); set('broker_contacts', ''); setDisp('broker', item.label); }}
              onClear={() => { set('broker', null); set('broker_contacts', ''); setDisp('broker', ''); }}
            />
          </div>
          <div className="col-md-4">
            <BrokerContactsSelect
              brokerId={form.broker}
              contacts={brokerContacts}
              loading={loadingBrokerContacts}
              value={form.broker_contacts}
              onChange={(value) => set('broker_contacts', value)}
              onContactCreated={async (contact) => {
                const contacts = await loadBrokerContacts(form.broker);
                if (!contacts.some((item) => String(item.id) === String(contact.id))) {
                  setBrokerContacts((current) => [...current, contact]);
                }
                setForm((current) => ({
                  ...current,
                  broker_contacts: Array.from(new Set([
                    ...csvToIds(current.broker_contacts),
                    String(contact.id),
                  ])).join(','),
                }));
              }}
            />
          </div>
        </div>

        {/* Row 3: Pickup Address | Dropoff Address */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="control-label">Pickup Address</label>
            <input type="text" className="form-control form-control-sm" value={form.pickup_address}
              onChange={e => set('pickup_address', e.target.value)} autoComplete="off" ref={pickupAddressRef} />
          </div>
          <div className="col-md-6">
            <label className="control-label">Dropoff Address</label>
            <input type="text" className="form-control form-control-sm" value={form.dropoff_address}
              onChange={e => set('dropoff_address', e.target.value)} autoComplete="off" ref={dropoffAddressRef} />
          </div>
        </div>

        {/* Row 4: Pickup City | Dropoff City */}
        <div className="row mb-3">
          <div className="col-md-6">
            <AsyncSearch
              label={<>Pick Up City <i className="bi bi-geo-alt-fill text-success ms-1" /></>}
              placeholder="Type 2+ chars to search..."
              value={form.pickup_city}
              displayValue={display.pickup_city}
              onSearch={searchCities}
              onSelect={item => { set('pickup_city', item.id); setDisp('pickup_city', item.label); }}
              onClear={() => { set('pickup_city', null); setDisp('pickup_city', ''); }}
            />
            {err('pickup_city')}
          </div>
          <div className="col-md-6">
            <AsyncSearch
              label={<>Drop Off City <i className="bi bi-geo-alt-fill text-danger ms-1" /></>}
              placeholder="Type 2+ chars to search..."
              value={form.dropoff_city}
              displayValue={display.dropoff_city}
              onSearch={searchCities}
              onSelect={item => { set('dropoff_city', item.id); setDisp('dropoff_city', item.label); }}
              onClear={() => { set('dropoff_city', null); setDisp('dropoff_city', ''); }}
            />
            {err('dropoff_city')}
          </div>
        </div>

        {/* Row 5: Pickup Date | Dropoff Date */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="control-label">Pickup Date <span className="text-danger">*</span></label>
            <DateTimePicker
              value={form.pickup_date}
              onChange={v => set('pickup_date', v)}
              required
              className={`form-control form-control-sm ${errors.pickup_date ? 'is-invalid' : ''}`}
            />
            {err('pickup_date')}
          </div>
          <div className="col-md-4">
            <label className="control-label">Dropoff Date <span className="text-danger">*</span></label>
            <DateTimePicker
              value={form.dropoff_date}
              onChange={v => set('dropoff_date', v)}
              required
              minDate={form.pickup_date || null}
              className={`form-control form-control-sm ${errors.dropoff_date ? 'is-invalid' : ''}`}
            />
            {err('dropoff_date')}
          </div>
        </div>

        {/* Row 6: Shipper | Receiver */}
        <div className="row mb-3">
          <div className="col-md-6">
            <AsyncSearch
              label="Shipper"
              placeholder="Type to search shipper..."
              value={form.shipper}
              displayValue={display.shipper}
              onSearch={searchBusiness}
              onSelect={item => { set('shipper', item.id); setDisp('shipper', item.label); }}
              onClear={() => { set('shipper', null); setDisp('shipper', ''); }}
              required
              isInvalid={!!errors.shipper}
              labelAddon={
                <button type="button" className="btn btn-default btn-xs border py-0 px-1"
                  title="New business" onClick={() => setShowNewShipper(v => !v)}>
                  <i className="bi bi-plus" />
                </button>
              }
            />
            {showNewShipper && (
              <BusinessCreateRow
                onSave={biz => { set('shipper', biz.id); setDisp('shipper', biz.name); setShowNewShipper(false); }}
                onCancel={() => setShowNewShipper(false)}
              />
            )}
            {err('shipper')}
          </div>
          <div className="col-md-6">
            <AsyncSearch
              label="Receiver"
              placeholder="Type to search receiver..."
              value={form.receiver}
              displayValue={display.receiver}
              onSearch={searchBusiness}
              onSelect={item => { set('receiver', item.id); setDisp('receiver', item.label); }}
              onClear={() => { set('receiver', null); setDisp('receiver', ''); }}
              required
              isInvalid={!!errors.receiver}
              labelAddon={
                <button type="button" className="btn btn-default btn-xs border py-0 px-1"
                  title="New business" onClick={() => setShowNewReceiver(v => !v)}>
                  <i className="bi bi-plus" />
                </button>
              }
            />
            {showNewReceiver && (
              <BusinessCreateRow
                onSave={biz => { set('receiver', biz.id); setDisp('receiver', biz.name); setShowNewReceiver(false); }}
                onCancel={() => setShowNewReceiver(false)}
              />
            )}
            {err('receiver')}
          </div>
        </div>

        {/* Row 7: Miles + Financials */}
        <div className="row mb-3">
          <div className="col-md-2">
            <label className="control-label">Miles</label>
            <input type="number" className="form-control form-control-sm" value={form.miles}
              onChange={e => set('miles', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="col-md-2">
            <label className="control-label">Miles Empty</label>
            <input type="number" className="form-control form-control-sm" value={form.miles_empty}
              onChange={e => set('miles_empty', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="col-md-2">
            <label className="control-label">Detention ($)</label>
            <input type="number" step="0.01" className="form-control form-control-sm" value={form.detention}
              onChange={e => set('detention', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="col-md-2">
            <label className="control-label">Lumper ($)</label>
            <input type="number" step="0.01" className="form-control form-control-sm" value={form.lumper}
              onChange={e => set('lumper', parseFloat(e.target.value) || 0)} />
          </div>
          <div className="col-md-2">
            <label className="control-label">Lumper Paid By</label>
            <select className="form-select form-select-sm" value={form.lumper_paid_by}
              onChange={e => set('lumper_paid_by', e.target.value)}>
              {LUMPER_PAID_BY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="control-label">Drop Trailer ($)</label>
            <input type="number" step="0.01" className="form-control form-control-sm" value={form.drop_trailer}
              onChange={e => set('drop_trailer', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        {/* Row 8: Details */}
        <div className="row mb-4">
          <div className="col-md-12">
            <label className="control-label">Details / Notes</label>
            <textarea className="form-control form-control-sm" rows={3}
              value={form.details} onChange={e => set('details', e.target.value)} />
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm me-2" />}
            {isEdit ? 'Save Changes' : 'Create Load'}
          </button>
          <button type="button" className="btn btn-default border" onClick={() => navigate('/loads')}>
            Cancel
          </button>
        </div>

      </form>
    </div>
  );
}
