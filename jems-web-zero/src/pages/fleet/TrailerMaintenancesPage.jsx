import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { trailerMaintenanceService } from '../../services/trailerMaintenance';
import { trailersService } from '../../services/trailers';

function AlertBadge({ enabled, threshold, unit }) {
  if (!enabled) return <span className="text-muted small">—</span>;
  return (
    <span className="badge bg-warning text-dark">
      <i className="bi bi-bell-fill me-1" />
      {threshold ? threshold.toLocaleString() : '—'} {unit}
    </span>
  );
}

function TimeAlertBadge({ enabled, years, months }) {
  if (!enabled) return <span className="text-muted small">—</span>;
  const parts = [];
  if (years > 0) parts.push(`${years} yr`);
  if (months > 0) parts.push(`${months} mo`);
  const label = parts.length ? parts.join(' ') : '—';
  return (
    <span className="badge bg-warning text-dark">
      <i className="bi bi-clock-fill me-1" />{label}
    </span>
  );
}

function MaintenanceRow({ record, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete maintenance record for trailer ${record.trailer_number} on ${record.date}?`)) return;
    setDeleting(true);
    try {
      await trailerMaintenanceService.destroy(record.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr>
      <td className="align-middle fw-semibold">{record.date}</td>
      <td className="align-middle">
        <Link to={`/fleet/trailers/${record.trailer}`} className="text-decoration-none">
          {record.trailer_number}
        </Link>
        {record.trailer_vin && <div className="text-muted small">{record.trailer_vin}</div>}
      </td>
      <td className="align-middle">
        <AlertBadge enabled={record.miles_alert} threshold={record.miles} unit="mi" />
      </td>
      <td className="align-middle">
        <TimeAlertBadge enabled={record.time_alert} years={record.time_year} months={record.time_month} />
      </td>
      <td className="align-middle small">{record.detail || <span className="text-muted">—</span>}</td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/fleet/trailer-maintenance/${record.id}/edit`}
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

export default function TrailerMaintenancesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trailers, setTrailers] = useState([]);

  const [search, setSearch] = useState('');
  const [trailerFilter, setTrailerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (trailerFilter) params.trailer = trailerFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (search) params.search = search;
      const res = await trailerMaintenanceService.list(params);
      setRecords(res.data);
    } catch {
      setError('Error loading trailer maintenance records.');
    } finally {
      setLoading(false);
    }
  }, [trailerFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    trailersService.list().then((r) => setTrailers(r.data)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    return records.filter(
      (r) =>
        (r.trailer_number || '').toLowerCase().includes(search.trim().toLowerCase()) ||
        (r.detail || '').toLowerCase().includes(search.trim().toLowerCase())
    );
  }, [records, search]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-wrench me-2" />Trailers Maintenances
        </h5>
        <Link to="/fleet/trailer-maintenance/create" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1" />New Record
        </Link>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Trailer</label>
              <select
                className="form-select form-select-sm"
                value={trailerFilter}
                onChange={(e) => setTrailerFilter(e.target.value)}
              >
                <option value="">All trailers</option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>{t.number}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Date from</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Date to</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Trailer number or detail…"
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
                  <th>Trailer</th>
                  <th>Miles Alert</th>
                  <th>Time Alert</th>
                  <th>Detail</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">Loading…</td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">No records found.</td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((r) => (
                    <MaintenanceRow key={r.id} record={r} onDeleted={load} />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
