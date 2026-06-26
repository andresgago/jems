import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DateRangePicker from '../../components/DateRangePicker';
import { useLoads } from '../../hooks/useLoads';
import { brokersService } from '../../services/brokers';
import { driversService } from '../../services/drivers';
import { loadsService } from '../../services/loads';

const DATE_TYPE_OPTIONS = [
  { value: '1', label: 'Pick up date' },
  { value: '2', label: 'Drop off date' },
  { value: '3', label: 'Show all (Ignore dates)' },
];

const LOAD_STATUS_CANCELLED = 5;

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildParams(draft) {
  const params = { history_search: true, all: true };
  if (draft.date_type) params.date_type = draft.date_type;
  if (draft.date_from) params.date_from = draft.date_from;
  if (draft.date_to)   params.date_to   = draft.date_to;
  if (draft.broker)     params.broker     = draft.broker;
  if (draft.driver)     params.driver     = draft.driver;
  if (draft.number)     params.number     = draft.number;
  return params;
}

export default function HistoryPage() {
  const [draft, setDraft] = useState({ date_type: '3' });
  const [applied, setApplied] = useState({});
  const [brokers, setBrokers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const filters = useMemo(() => buildParams(applied), [applied]);
  const { loads, loading, error, refresh } = useLoads(filters);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const applyFilters = (overrides) => {
    const next = { ...draft, ...overrides };
    setDraft(next);
    setApplied(next);
  };

  const handleFilter = (event) => {
    event.preventDefault();
    applyFilters({});
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      brokersService.options(),
      driversService.list(),
    ]).then(([brokerResponse, driverResponse]) => {
      if (cancelled) return;
      setBrokers(Array.isArray(brokerResponse.data) ? brokerResponse.data : []);
      setDrivers(Array.isArray(driverResponse.data) ? driverResponse.data : []);
    }).catch(() => {
      if (!cancelled) {
        setBrokers([]);
        setDrivers([]);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Send back to executed queue (un-history)
  const handleSetHistoryBack = useCallback(async (load) => {
    if (!window.confirm(`Send load #${load.number} back to executed queue?`)) return;
    setActionLoading(true);
    try { await loadsService.setHistory(load.id); refresh(); }
    finally { setActionLoading(false); }
  }, [refresh]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-3 gap-2">
        <h4 className="mb-0"><i className="bi bi-archive me-2" />Load History</h4>
        <span className="badge bg-secondary ms-2">{loads.length}</span>
      </div>

      {/* Search bar */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <form className="load-search-band history-search-band mb-0" onSubmit={handleFilter}>
            <div className="load-filter">
              <label>Date range</label>
              <DateRangePicker
                start={draft.date_from || ''}
                end={draft.date_to || ''}
                onApply={({ start, end }) => {
                  setField('date_from', start);
                  setField('date_to', end);
                }}
              />
            </div>
            <div className="load-filter">
              <label htmlFor="history-date-type">Date type</label>
              <select id="history-date-type" className="form-select form-select-sm h-100" value={draft.date_type || '3'} onChange={(e) => setField('date_type', e.target.value)}>
                {DATE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="load-filter">
              <label htmlFor="history-broker">Broker</label>
              <select id="history-broker" className="form-select form-select-sm h-100" value={draft.broker || ''} onChange={(e) => setField('broker', e.target.value)}>
                <option value="">Show all broker</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>{broker.label || broker.name}</option>
                ))}
              </select>
            </div>
            <div className="load-filter">
              <label htmlFor="history-driver">Driver</label>
              <select id="history-driver" className="form-select form-select-sm h-100" value={draft.driver || ''} onChange={(e) => setField('driver', e.target.value)}>
                <option value="">Show all driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim()}</option>
                ))}
              </select>
            </div>
            <div className="load-filter">
              <label htmlFor="history-order">Order #</label>
              <input id="history-order" className="form-control form-control-sm h-100" value={draft.number || ''} onChange={(e) => setField('number', e.target.value)} placeholder="Order #" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm load-search-button">
              <i className="bi bi-search me-1" />Search
            </button>
          </form>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error.message || 'Error loading loads.'}</div>}

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Broker</th>
                <th>Order</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Driver</th>
                <th>Truck</th>
                <th>Trailer</th>
                <th>Files</th>
                <th title="Invoiced"><i className="bi bi-receipt" /></th>
                <th title="Paid"><i className="bi bi-cash-coin" /></th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={12} className="text-center text-muted py-4">
                    <span className="spinner-border spinner-border-sm me-2" />Loading…
                  </td>
                </tr>
              )}
              {!loading && loads.length === 0 && (
                <tr><td colSpan={12} className="text-center text-muted py-4">No history loads found.</td></tr>
              )}
              {!loading && loads.map((load, idx) => (
                <tr key={load.id}>
                  <td className="text-muted small">{idx + 1}</td>
                  <td className="small">
                    <span title={[load.broker_mc, load.broker_email, load.broker_phone].filter(Boolean).join(' | ')}>
                      {load.broker_name || '—'}
                      {load.broker_mc ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>({load.broker_mc})</div> : null}
                    </span>
                  </td>
                  <td>
                    <Link to={`/loads/${load.id}`} className="fw-semibold small">{load.number}</Link>
                    {load.status === LOAD_STATUS_CANCELLED && (
                      <span className="ms-1" title="Cancelled"><i className="bi bi-x-circle-fill text-danger" style={{ fontSize: '0.85rem' }} /></span>
                    )}
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{formatMoney(load.payment)}</div>
                  </td>
                  <td className="small">
                    <div>{load.pickup_city_name || '—'}{load.pickup_city_state ? ` (${load.pickup_city_state})` : ''}</div>
                    {load.pickup_city_zip ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>{load.pickup_city_zip}</div> : null}
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{formatDateTime(load.pickup_date)}</div>
                  </td>
                  <td className="small">
                    <div>{load.dropoff_city_name || '—'}{load.dropoff_city_state ? ` (${load.dropoff_city_state})` : ''}</div>
                    {load.dropoff_city_zip ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>{load.dropoff_city_zip}</div> : null}
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{formatDateTime(load.dropoff_date)}</div>
                  </td>
                  <td className="small">{load.driver_name || '—'}</td>
                  <td className="small">{load.truck_number || '—'}</td>
                  <td className="small">
                    <div>{load.trailer_number || '—'}</div>
                    {load.trailer_type_name ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>{load.trailer_type_name}</div> : null}
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      {load.rate_file && <a href={load.rate_file} target="_blank" rel="noreferrer" title="Rate Confirmation"><i className="bi bi-file-earmark-text text-primary" /></a>}
                      {load.bill_file && <a href={load.bill_file} target="_blank" rel="noreferrer" title="POD"><i className="bi bi-file-earmark-check text-success" /></a>}
                      {load.lumper_file && <a href={load.lumper_file} target="_blank" rel="noreferrer" title="Lumper"><i className="bi bi-file-earmark-dollar text-warning" /></a>}
                      {load.detention_file && <a href={load.detention_file} target="_blank" rel="noreferrer" title="Detention"><i className="bi bi-file-earmark-exclamation text-danger" /></a>}
                    </div>
                  </td>
                  <td className="text-center">
                    <i className={`bi ${load.invoiced ? 'bi-check-square-fill text-success' : 'bi-square text-muted opacity-50'}`} title={load.invoiced ? 'Invoiced' : 'Not invoiced'} />
                  </td>
                  <td className="text-center">
                    <i className={`bi ${load.paid ? 'bi-check-square-fill text-success' : 'bi-square text-muted opacity-50'}`} title={load.paid ? 'Paid' : 'Not paid'} />
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Link to={`/loads/${load.id}`} className="btn btn-sm btn-outline-secondary" style={{ padding: '2px 6px' }} title="View">
                        <i className="bi bi-eye" />
                      </Link>
                      <button
                        className="btn btn-sm btn-outline-warning"
                        style={{ padding: '2px 6px' }}
                        title="Send back to executed queue"
                        disabled={actionLoading}
                        onClick={() => handleSetHistoryBack(load)}
                      >
                        <i className="bi bi-chevron-left" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
