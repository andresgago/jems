import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DateRangePicker from '../../components/DateRangePicker';
import { useLoads } from '../../hooks/useLoads';
import { loadsService } from '../../services/loads';

const DATE_TYPE_OPTIONS = [
  { value: 'all',     label: 'Show all (Ignore dates)' },
  { value: 'pickup',  label: 'Pickup date' },
  { value: 'dropoff', label: 'Delivery date' },
  { value: 'created', label: 'Created date' },
];

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
  const params = { execute: true, history: false, all: true };
  if (draft.date_type && draft.date_type !== 'all') params.date_type = draft.date_type;
  if (draft.date_from) params.date_from = draft.date_from;
  if (draft.date_to)   params.date_to   = draft.date_to;
  if (draft.broker)    params.broker    = draft.broker;
  if (draft.dispatcher) params.dispatcher = draft.dispatcher;
  if (draft.number)    params.number    = draft.number;
  return params;
}

export default function ExecutedPage() {
  const [draft, setDraft] = useState({ date_type: 'pickup' });
  const [applied, setApplied] = useState({ date_type: 'pickup' });
  const [selected, setSelected] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  const filters = useMemo(() => buildParams(applied), [applied]);
  const { loads, loading, error, refresh } = useLoads(filters);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const applyFilters = (overrides) => {
    const next = { ...draft, ...overrides };
    setDraft(next);
    setApplied(next);
    setSelected(new Set());
  };

  const submitOnEnter = (e) => { if (e.key === 'Enter') applyFilters({}); };

  const total = useMemo(
    () => loads.reduce((s, l) => s + Number(l.payment || 0), 0),
    [loads],
  );

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const allChecked = loads.length > 0 && loads.every((l) => selected.has(l.id));
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(loads.map((l) => l.id)));

  const handleToggleInvoiced = useCallback(async (load) => {
    setActionLoading(true);
    try { await loadsService.toggleInvoiced(load.id); refresh(); }
    finally { setActionLoading(false); }
  }, [refresh]);

  const handleSetExecutedBack = useCallback(async (load) => {
    if (!window.confirm(`Send load #${load.number} back to dispatch (un-execute)?`)) return;
    setActionLoading(true);
    try { await loadsService.setExecuted(load.id); refresh(); }
    finally { setActionLoading(false); }
  }, [refresh]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-3 gap-2">
        <h4 className="mb-0"><i className="bi bi-check2-circle me-2" />Executed Loads</h4>
        <span className="badge bg-secondary ms-2">{loads.length}</span>
      </div>

      {/* Search bar */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label mb-1 small">Date range</label>
              <DateRangePicker
                value={{ from: draft.date_from || '', to: draft.date_to || '' }}
                onChange={({ from, to }) => { setField('date_from', from); setField('date_to', to); }}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1 small">Date type</label>
              <select className="form-select form-select-sm" value={draft.date_type || 'all'} onChange={(e) => setField('date_type', e.target.value)}>
                {DATE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1 small">Broker</label>
              <input className="form-control form-control-sm" value={draft.broker || ''} onChange={(e) => setField('broker', e.target.value)} onKeyDown={submitOnEnter} placeholder="Broker name / MC" />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1 small">Dispatcher</label>
              <input className="form-control form-control-sm" value={draft.dispatcher || ''} onChange={(e) => setField('dispatcher', e.target.value)} onKeyDown={submitOnEnter} placeholder="Dispatcher" />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1 small">Order #</label>
              <input className="form-control form-control-sm" value={draft.number || ''} onChange={(e) => setField('number', e.target.value)} onKeyDown={submitOnEnter} placeholder="Order #" />
            </div>
            <div className="col-md-1">
              <button className="btn btn-primary btn-sm w-100" onClick={() => applyFilters({})}>Search</button>
            </div>
          </div>
        </div>
      </div>

      {/* Deferred actions (require DriverInvoice model) */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {/* TODO: enable when DriverInvoice is built */}
        <button className="btn btn-success btn-sm" disabled title="Requires DriverInvoice module">
          <i className="bi bi-arrow-right-square me-1" />Move to Invoice
        </button>
        <button className="btn btn-outline-secondary btn-sm" disabled title="Requires DriverInvoice module">
          <i className="bi bi-arrow-repeat me-1" />Rebuild Invoices
        </button>
        <span className="text-muted small align-self-center">Select rows + driver to use Move to Invoice</span>
      </div>

      {error && <div className="alert alert-danger">{error.message || 'Error loading loads.'}</div>}

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm table-hover table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th>#</th>
                <th>Driver / Truck</th>
                <th>Dispatcher</th>
                <th>Order</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th className="text-end">Payment</th>
                <th>Files</th>
                <th>Invoiced</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="text-center text-muted py-4">
                    <span className="spinner-border spinner-border-sm me-2" />Loading…
                  </td>
                </tr>
              )}
              {!loading && loads.length === 0 && (
                <tr><td colSpan={11} className="text-center text-muted py-4">No executed loads found.</td></tr>
              )}
              {!loading && loads.map((load, idx) => (
                <tr key={load.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(load.id)}
                      onChange={() => toggleRow(load.id)}
                    />
                  </td>
                  <td className="text-muted small">{idx + 1}</td>
                  <td>
                    <div className="fw-semibold small">
                      {load.driver_name || <span className="text-muted">No driver</span>}
                    </div>
                    {load.truck_number && (
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Truck {load.truck_number}
                        {load.trailer_number ? ` / Trailer ${load.trailer_number}` : ''}
                      </div>
                    )}
                    {load.paid
                      ? <span className="badge bg-success-subtle text-success" style={{ fontSize: '0.7rem' }}>Paid</span>
                      : <span className="badge bg-danger-subtle text-danger" style={{ fontSize: '0.7rem' }}>Not Paid</span>}
                  </td>
                  <td className="small">{load.dispatcher_name || '—'}</td>
                  <td>
                    <Link to={`/loads/${load.id}`} className="fw-semibold small">{load.number}</Link>
                  </td>
                  <td className="small">
                    <div>{load.pickup_city_name || '—'}{load.pickup_city_state ? ` (${load.pickup_city_state})` : ''}</div>
                    <div className="text-muted">{formatDateTime(load.pickup_date)}</div>
                  </td>
                  <td className="small">
                    <div>{load.dropoff_city_name || '—'}{load.dropoff_city_state ? ` (${load.dropoff_city_state})` : ''}</div>
                    <div className="text-muted">{formatDateTime(load.dropoff_date)}</div>
                  </td>
                  <td className="text-end fw-semibold small">{formatMoney(load.payment)}</td>
                  <td>
                    <div className="d-flex gap-1">
                      {load.rate_file && <a href={load.rate_file} target="_blank" rel="noreferrer" title="Rate Confirmation"><i className="bi bi-file-earmark-text text-primary" /></a>}
                      {load.bill_file && <a href={load.bill_file} target="_blank" rel="noreferrer" title="POD"><i className="bi bi-file-earmark-check text-success" /></a>}
                      {load.lumper_file && <a href={load.lumper_file} target="_blank" rel="noreferrer" title="Lumper"><i className="bi bi-file-earmark-dollar text-warning" /></a>}
                      {load.detention_file && <a href={load.detention_file} target="_blank" rel="noreferrer" title="Detention"><i className="bi bi-file-earmark-exclamation text-danger" /></a>}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${load.invoiced ? 'btn-success' : 'btn-outline-secondary'}`}
                      style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                      title={load.invoiced ? 'Invoiced — click to toggle' : 'Not invoiced — click to toggle'}
                      disabled={actionLoading}
                      onClick={() => handleToggleInvoiced(load)}
                    >
                      <i className={`bi ${load.invoiced ? 'bi-check-square-fill' : 'bi-square'}`} />
                    </button>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Link to={`/loads/${load.id}`} className="btn btn-sm btn-outline-secondary" style={{ padding: '2px 6px' }} title="View">
                        <i className="bi bi-eye" />
                      </Link>
                      <button
                        className="btn btn-sm btn-outline-warning"
                        style={{ padding: '2px 6px' }}
                        title="Send back to dispatch (un-execute)"
                        disabled={actionLoading}
                        onClick={() => handleSetExecutedBack(load)}
                      >
                        <i className="bi bi-chevron-left" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && loads.length > 0 && (
              <tfoot>
                <tr className="table-secondary fw-bold">
                  <td colSpan={7} className="text-end small">Total</td>
                  <td className="text-end small">{formatMoney(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
