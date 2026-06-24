import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDrivers } from '../../hooks/useDrivers';
import { driversService, DRIVER_STATUS } from '../../services/drivers';

function StatusBadge({ status }) {
  const s = DRIVER_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

// Highlights a date that is in the past (expired) or empty.
function ExpDate({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  const expired = new Date(value) < new Date(new Date().toDateString());
  return <span className={expired ? 'text-danger fw-semibold' : ''}>{value}</span>;
}

function DriverRow({ driver, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const toggle = async () => {
    if (!window.confirm(`Toggle status for ${driver.full_name}?`)) return;
    setActioning(true);
    try {
      await driversService.toggleStatus(driver.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr>
      <td className="align-middle">
        <Link to={`/drivers/${driver.id}`} className="fw-semibold text-decoration-none">
          {driver.full_name}
        </Link>
        {driver.on_vacation && (
          <span className="badge bg-info-subtle text-info-emphasis ms-2">On Vacation</span>
        )}
      </td>
      <td className="align-middle">{driver.driver_type_name || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{driver.phone || <span className="text-muted">—</span>}</td>
      <td className="align-middle small">{driver.email || <span className="text-muted">—</span>}</td>
      <td className="align-middle"><ExpDate value={driver.license_expiration} /></td>
      <td className="align-middle"><ExpDate value={driver.medical_card_expiration} /></td>
      <td className="align-middle text-center"><StatusBadge status={driver.status} /></td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link to={`/drivers/${driver.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/drivers/${driver.id}/edit`} className="btn btn-sm btn-outline-secondary py-0" title="Edit">
            <i className="bi bi-pencil" />
          </Link>
          <button
            className="btn btn-sm btn-outline-dark py-0"
            title="Toggle status"
            disabled={actioning}
            onClick={toggle}
          >
            <i className="bi bi-toggle-on" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DriversPage() {
  const { drivers, loading, error, refresh } = useDrivers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      if (statusFilter !== '' && String(d.status) !== statusFilter) return false;
      if (q && !d.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [drivers, search, statusFilter]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-people me-2" />Drivers
        </h5>
        <Link to="/drivers/create" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1" />New Driver
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">Error loading drivers.</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>License Exp.</th>
                  <th>Medical Exp.</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No drivers found.</td></tr>
                )}
                {!loading && filtered.map((d) => (
                  <DriverRow key={d.id} driver={d} onChanged={refresh} />
                ))}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot>
                  <tr className="table-secondary">
                    <td colSpan={8} className="small text-muted ps-2">
                      {filtered.length} driver{filtered.length !== 1 ? 's' : ''}
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
