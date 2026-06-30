import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { accidentsService } from '../../services/accidents';
import { trucksService } from '../../services/trucks';

function AccidentRow({ accident, trucks, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete accident #${accident.id}?`)) return;
    setDeleting(true);
    try {
      await accidentsService.destroy(accident.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const truckLabel = accident.truck
    ? (trucks.find((t) => t.id === accident.truck)?.number ?? `#${accident.truck}`)
    : '—';

  const dateStr = accident.date
    ? new Date(accident.date).toLocaleDateString()
    : '—';

  return (
    <tr>
      <td className="align-middle fw-semibold">{dateStr}</td>
      <td className="align-middle">{accident.crash_number || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{truckLabel}</td>
      <td className="align-middle small">{accident.address || <span className="text-muted">—</span>}</td>
      <td className="align-middle text-center">
        {accident.tow_aways
          ? <span className="badge bg-danger">Yes</span>
          : <span className="badge bg-secondary">No</span>}
      </td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/fleet/accidents/${accident.id}`}
            className="btn btn-sm btn-outline-primary py-0"
            title="View"
          >
            <i className="bi bi-eye" />
          </Link>
          <Link
            to={`/fleet/accidents/${accident.id}/edit`}
            className="btn btn-sm btn-outline-secondary py-0"
            title="Edit"
          >
            <i className="bi bi-pencil" />
          </Link>
          <button
            className="btn btn-sm btn-outline-danger py-0"
            title="Delete"
            disabled={deleting}
            onClick={handleDelete}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AccidentsPage() {
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [truckFilter, setTruckFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = truckFilter ? { truck: truckFilter } : {};
      const res = await accidentsService.list(params);
      setAccidents(res.data);
    } catch {
      setError('Error loading accidents.');
    } finally {
      setLoading(false);
    }
  }, [truckFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accidents;
    return accidents.filter(
      (a) =>
        (a.crash_number || '').toLowerCase().includes(q) ||
        (a.address || '').toLowerCase().includes(q)
    );
  }, [accidents, search]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-exclamation-triangle me-2" />Accidents
        </h5>
        <Link to="/fleet/accidents/create" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1" />New Accident
        </Link>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Filter by truck</label>
              <select
                className="form-select form-select-sm"
                value={truckFilter}
                onChange={(e) => setTruckFilter(e.target.value)}
              >
                <option value="">All trucks</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>{t.number}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Crash number or address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Date</th>
                  <th>Crash #</th>
                  <th>Truck</th>
                  <th>Address</th>
                  <th className="text-center">Tow-away</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">No accidents found.</td></tr>
                )}
                {!loading && filtered.map((a) => (
                  <AccidentRow key={a.id} accident={a} trucks={trucks} onDeleted={load} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
