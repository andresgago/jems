import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrucks } from '../../hooks/useTrucks';
import { trucksService, TRUCK_STATUS } from '../../services/trucks';

function StatusBadge({ status }) {
  const s = TRUCK_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function ExpDate({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  const expired = new Date(value) < new Date(new Date().toDateString());
  return <span className={expired ? 'text-danger fw-semibold' : ''}>{value}</span>;
}

function TruckRow({ truck, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const toggle = async () => {
    if (!window.confirm(`Toggle status for truck ${truck.number}?`)) return;
    setActioning(true);
    try {
      await trucksService.toggleStatus(truck.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr>
      <td className="align-middle">
        <Link to={`/fleet/trucks/${truck.id}`} className="fw-semibold text-decoration-none">
          {truck.number}
        </Link>
      </td>
      <td className="align-middle">{truck.truck_type_name || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{truck.plate || <span className="text-muted">—</span>}</td>
      <td className="align-middle small">{truck.vin || <span className="text-muted">—</span>}</td>
      <td className="align-middle text-center">{truck.year || <span className="text-muted">—</span>}</td>
      <td className="align-middle"><ExpDate value={truck.avi_expiration} /></td>
      <td className="align-middle"><ExpDate value={truck.registration_expiration} /></td>
      <td className="align-middle text-center"><StatusBadge status={truck.status} /></td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link to={`/fleet/trucks/${truck.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/fleet/trucks/${truck.id}/edit`} className="btn btn-sm btn-outline-secondary py-0" title="Edit">
            <i className="bi bi-pencil" />
          </Link>
          <button className="btn btn-sm btn-outline-dark py-0" title="Toggle status" disabled={actioning} onClick={toggle}>
            <i className="bi bi-toggle-on" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TrucksPage() {
  const { trucks, loading, error, refresh } = useTrucks();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trucks;
    return trucks.filter(
      (t) => t.number.toLowerCase().includes(q) || (t.vin || '').toLowerCase().includes(q)
    );
  }, [trucks, search]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-truck me-2" />Trucks</h5>
        <Link to="/fleet/trucks/create" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1" />New Truck
        </Link>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Number or VIN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">Error loading trucks.</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Plate</th>
                  <th>VIN</th>
                  <th className="text-center">Year</th>
                  <th>AVI Exp.</th>
                  <th>Reg. Exp.</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-muted py-4">No trucks found.</td></tr>
                )}
                {!loading && filtered.map((t) => (
                  <TruckRow key={t.id} truck={t} onChanged={refresh} />
                ))}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot>
                  <tr className="table-secondary">
                    <td colSpan={9} className="small text-muted ps-2">
                      {filtered.length} truck{filtered.length !== 1 ? 's' : ''}
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
