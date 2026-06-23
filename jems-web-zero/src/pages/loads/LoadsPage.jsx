import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoads } from '../../hooks/useLoads';
import { loadsService, LOAD_STATUS } from '../../services/loads';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: '1', label: 'Registered' },
  { value: '2', label: 'Started' },
  { value: '3', label: 'Finished' },
  { value: '4', label: 'Detention Pending' },
  { value: '5', label: 'Cancelled' },
];

function StatusBadge({ status }) {
  const s = LOAD_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function LoadRow({ load, onStatusChange }) {
  const [actioning, setActioning] = useState(false);

  const handleStatus = async (newStatus) => {
    if (!window.confirm(`Change status to ${LOAD_STATUS[newStatus]?.label}?`)) return;
    setActioning(true);
    try {
      await loadsService.setStatus(load.id, newStatus);
      onStatusChange();
    } finally {
      setActioning(false);
    }
  };

  const handleHistory = async () => {
    if (!window.confirm('Move this load to history?')) return;
    setActioning(true);
    try {
      await loadsService.setHistory(load.id);
      onStatusChange();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr>
      <td className="text-center align-middle">
        <Link to={`/loads/${load.id}`} className="fw-semibold text-decoration-none">
          {load.number}
        </Link>
        <br />
        <small className="text-muted">${load.payment?.toLocaleString()}</small>
      </td>
      <td className="align-middle text-center">
        {load.broker ? <span className="small">{load.broker}</span> : <span className="text-muted">—</span>}
      </td>
      <td className="align-middle">
        <span>{load.pickup_city_display || '—'}</span>
        <br />
        <small className="text-muted">{load.pickup_date}</small>
      </td>
      <td className="align-middle">
        <span>{load.dropoff_city_display || '—'}</span>
        <br />
        <small className="text-muted">{load.dropoff_date}</small>
      </td>
      <td className="align-middle text-center">
        {load.driver ? (
          <small>
            Driver #{load.driver}
            <br />
            <span className="text-muted">Truck #{load.truck || '—'}</span>
          </small>
        ) : (
          <span className="text-muted small">Unassigned</span>
        )}
      </td>
      <td className="align-middle text-center">
        <StatusBadge status={load.status} />
      </td>
      <td className="align-middle text-center">
        <i className={`bi bi-circle-fill fs-6 ${load.invoiced ? 'text-success' : 'text-secondary opacity-25'}`} title={load.invoiced ? 'Invoiced' : 'Not invoiced'} />
      </td>
      <td className="align-middle text-center">
        <i className={`bi bi-circle-fill fs-6 ${load.paid ? 'text-success' : 'text-secondary opacity-25'}`} title={load.paid ? 'Paid' : 'Not paid'} />
      </td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center flex-wrap">
          <Link to={`/loads/${load.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/loads/${load.id}/edit`} className="btn btn-sm btn-outline-secondary py-0" title="Edit">
            <i className="bi bi-pencil" />
          </Link>
          <div className="dropdown">
            <button
              className="btn btn-sm btn-outline-dark py-0 dropdown-toggle"
              data-bs-toggle="dropdown"
              disabled={actioning}
            >
              Status
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              {load.status !== 3 && (
                <li>
                  <button className="dropdown-item" onClick={() => handleStatus(3)}>
                    <i className="bi bi-check-circle me-1 text-success" />Delivered
                  </button>
                </li>
              )}
              {load.status !== 4 && (
                <li>
                  <button className="dropdown-item" onClick={() => handleStatus(4)}>
                    <i className="bi bi-pause-circle me-1 text-warning" />Mark as Detention
                  </button>
                </li>
              )}
              {load.status === 1 && (
                <li>
                  <button className="dropdown-item text-danger" onClick={() => handleStatus(5)}>
                    <i className="bi bi-x-circle me-1" />Cancel Load
                  </button>
                </li>
              )}
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item" onClick={handleHistory}>
                  <i className="bi bi-archive me-1" />Move to History
                </button>
              </li>
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function LoadsPage() {
  const [filters, setFilters] = useState({ status: '1', history: false });
  const [draft, setDraft] = useState({ status: '1' });
  const { loads, loading, error, refresh } = useLoads(filters);

  const handleFilter = (e) => {
    e.preventDefault();
    setFilters({ ...draft, history: false });
  };

  const handleReset = () => {
    setDraft({ status: '1' });
    setFilters({ status: '1', history: false });
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-box-seam me-2" />Loads
        </h5>
        <Link to="/loads/create" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1" />New Load
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <form className="row g-2 align-items-end" onSubmit={handleFilter}>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">From</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={draft.date_from || ''}
                onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">To</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={draft.date_to || ''}
                onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
              />
            </div>
            <div className="col-auto">
              <div className="form-check mt-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="invoiced"
                  checked={draft.invoiced === 'true'}
                  onChange={(e) => setDraft({ ...draft, invoiced: e.target.checked ? 'true' : undefined })}
                />
                <label className="form-check-label small" htmlFor="invoiced">Invoiced</label>
              </div>
            </div>
            <div className="col-auto">
              <div className="form-check mt-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="paid"
                  checked={draft.paid === 'true'}
                  onChange={(e) => setDraft({ ...draft, paid: e.target.checked ? 'true' : undefined })}
                />
                <label className="form-check-label small" htmlFor="paid">Paid</label>
              </div>
            </div>
            <div className="col-auto d-flex gap-2 mt-4">
              <button type="submit" className="btn btn-sm btn-primary">
                <i className="bi bi-search me-1" />Search
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleReset}>
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      {error && <div className="alert alert-danger">Error loading data.</div>}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th className="text-center">Load #</th>
                  <th className="text-center">Broker</th>
                  <th>Pick Up</th>
                  <th>Drop Off</th>
                  <th className="text-center">Driver / Truck</th>
                  <th className="text-center">Status</th>
                  <th className="text-center" title="Invoiced"><i className="bi bi-receipt" /></th>
                  <th className="text-center" title="Paid"><i className="bi bi-cash-coin" /></th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      <div className="spinner-border spinner-border-sm" />
                    </td>
                  </tr>
                )}
                {!loading && !error && loads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">No loads found.</td>
                  </tr>
                )}
                {!loading && loads.map((load) => (
                  <LoadRow key={load.id} load={load} onStatusChange={refresh} />
                ))}
              </tbody>
              {!loading && loads.length > 0 && (
                <tfoot>
                  <tr className="table-secondary">
                    <td colSpan={9} className="small text-muted ps-2">
                      {loads.length} load{loads.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
