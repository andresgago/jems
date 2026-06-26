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
  if (draft.date_from)  params.date_from  = draft.date_from;
  if (draft.date_to)    params.date_to    = draft.date_to;
  if (draft.dispatcher) params.dispatcher = draft.dispatcher;
  return params;
}

export default function InvoicingPage() {
  const [draft, setDraft]     = useState({ date_type: 'pickup' });
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

  const totals = useMemo(() => ({
    miles:   loads.reduce((s, l) => s + Number(l.miles || 0), 0),
    weight:  loads.reduce((s, l) => s + Number(l.weight || 0), 0),
    payment: loads.reduce((s, l) => s + Number(l.payment || 0), 0),
  }), [loads]);

  const allChecked = loads.length > 0 && loads.every((l) => selected.has(l.id));
  const toggleAll  = () => setSelected(allChecked ? new Set() : new Set(loads.map((l) => l.id)));
  const toggleRow  = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const handleToggleInvoiced = useCallback(async (load) => {
    setActionLoading(true);
    try { await loadsService.toggleInvoiced(load.id); refresh(); }
    finally { setActionLoading(false); }
  }, [refresh]);

  const handleBulkInvoiced = useCallback(async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Mark ${selected.size} load(s) as invoiced?`)) return;
    setActionLoading(true);
    try { await loadsService.bulkInvoiced([...selected]); refresh(); setSelected(new Set()); }
    finally { setActionLoading(false); }
  }, [selected, refresh]);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-3 gap-2">
        <h4 className="mb-0"><i className="bi bi-receipt me-2" />Invoicing</h4>
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
              <label className="form-label mb-1 small">Dispatcher</label>
              <input className="form-control form-control-sm" value={draft.dispatcher || ''} onChange={(e) => setField('dispatcher', e.target.value)} onKeyDown={submitOnEnter} placeholder="Dispatcher" />
            </div>
            <div className="col-md-1">
              <button className="btn btn-primary btn-sm w-100" onClick={() => applyFilters({})}>Search</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action */}
      <div className="d-flex gap-2 mb-3 align-items-center">
        <button
          className="btn btn-success btn-sm"
          disabled={selected.size === 0 || actionLoading}
          onClick={handleBulkInvoiced}
        >
          <i className="bi bi-receipt me-1" />Set to Invoiced ({selected.size})
        </button>
        {selected.size > 0 && <span className="text-muted small">{selected.size} selected</span>}
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
                <th>Broker</th>
                <th>Order</th>
                <th>Pickup date</th>
                <th>Delivery date</th>
                <th>Pickup city</th>
                <th>Delivery city</th>
                <th className="text-end">Miles</th>
                <th className="text-end">Weight</th>
                <th className="text-end">Payment</th>
                <th>Files</th>
                <th>Status</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={14} className="text-center text-muted py-4">
                    <span className="spinner-border spinner-border-sm me-2" />Loading…
                  </td>
                </tr>
              )}
              {!loading && loads.length === 0 && (
                <tr><td colSpan={14} className="text-center text-muted py-4">No executed loads found.</td></tr>
              )}
              {!loading && loads.map((load, idx) => (
                <tr key={load.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(load.id)} onChange={() => toggleRow(load.id)} />
                  </td>
                  <td className="text-muted small">{idx + 1}</td>
                  <td className="small">
                    <span title={[load.broker_mc, load.broker_email, load.broker_phone].filter(Boolean).join(' | ')}>
                      {load.broker_name || '—'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/loads/${load.id}`} className="fw-semibold small">{load.number}</Link>
                  </td>
                  <td className="small text-nowrap">{formatDateTime(load.pickup_date)}</td>
                  <td className="small text-nowrap">{formatDateTime(load.dropoff_date)}</td>
                  <td className="small">
                    {load.pickup_city_name || '—'}{load.pickup_city_state ? ` (${load.pickup_city_state})` : ''}
                    {load.pickup_city_zip ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>{load.pickup_city_zip}</div> : null}
                  </td>
                  <td className="small">
                    {load.dropoff_city_name || '—'}{load.dropoff_city_state ? ` (${load.dropoff_city_state})` : ''}
                    {load.dropoff_city_zip ? <div className="text-muted" style={{ fontSize: '0.7rem' }}>{load.dropoff_city_zip}</div> : null}
                  </td>
                  <td className="text-end small">{Number(load.miles || 0).toFixed(2)}</td>
                  <td className="text-end small">{Number(load.weight || 0).toFixed(2)}</td>
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
                    {load.invoiced
                      ? <span className="badge bg-success-subtle text-success">Invoiced</span>
                      : <span className="badge bg-danger-subtle text-danger">Non-Invoiced</span>}
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Link to={`/loads/${load.id}`} className="btn btn-sm btn-outline-secondary" style={{ padding: '2px 6px' }} title="View">
                        <i className="bi bi-eye" />
                      </Link>
                      <button
                        className={`btn btn-sm ${load.invoiced ? 'btn-success' : 'btn-outline-secondary'}`}
                        style={{ padding: '2px 6px' }}
                        title={load.invoiced ? 'Invoiced — click to toggle' : 'Not invoiced — click to toggle'}
                        disabled={actionLoading}
                        onClick={() => handleToggleInvoiced(load)}
                      >
                        <i className={`bi ${load.invoiced ? 'bi-check-square-fill' : 'bi-square'}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && loads.length > 0 && (
              <tfoot>
                <tr className="table-secondary fw-bold">
                  <td colSpan={8} className="text-end small">Total</td>
                  <td className="text-end small">{totals.miles.toFixed(2)}</td>
                  <td className="text-end small">{totals.weight.toFixed(2)}</td>
                  <td className="text-end small">{formatMoney(totals.payment)}</td>
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
