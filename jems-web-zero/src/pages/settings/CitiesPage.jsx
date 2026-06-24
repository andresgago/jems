import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { citiesService, CITY_STATUS } from '../../services/cities';
import { useOptions } from '../../hooks/useOptions';

function StatusBadge({ active }) {
  const s = CITY_STATUS[active] || CITY_STATUS[String(active)] || { label: String(active), cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function CityRow({ city, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const toggle = async () => {
    if (!window.confirm(`Toggle status for ${city.name}?`)) return;
    setActioning(true);
    try {
      await citiesService.toggleStatus(city.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr>
      <td className="align-middle fw-semibold">{city.zip}</td>
      <td className="align-middle">
        <Link to={`/settings/cities/${city.id}`} className="text-decoration-none">
          {city.name}
        </Link>
      </td>
      <td className="align-middle">{city.state_abbreviation || <span className="text-muted">—</span>}</td>
      <td className="align-middle small text-muted">{city.timezone || <span>—</span>}</td>
      <td className="align-middle text-center"><StatusBadge active={city.active} /></td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link to={`/settings/cities/${city.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/settings/cities/${city.id}/edit`} className="btn btn-sm btn-outline-secondary py-0" title="Edit">
            <i className="bi bi-pencil" />
          </Link>
          <button
            className="btn btn-sm btn-outline-warning py-0"
            onClick={toggle}
            disabled={actioning}
            title="Toggle status"
          >
            <i className="bi bi-toggle-on" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CitiesPage() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('1');
  const [tick, setTick] = useState(0);

  const states = useOptions('/locations/states/');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page };
    if (debouncedQ) params.q = debouncedQ;
    if (stateFilter) params.state = stateFilter;
    if (activeFilter !== '') params.active = activeFilter;
    citiesService.list(params)
      .then(({ data }) => {
        setItems(data.results || []);
        setCount(data.count || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedQ, stateFilter, activeFilter, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const pageSize = 50;
  const totalPages = Math.ceil(count / pageSize);

  const handleStateChange = (v) => { setStateFilter(v); setPage(1); };
  const handleActiveChange = (v) => { setActiveFilter(v); setPage(1); };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Cities</h4>
        <Link to="/settings/cities/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />Create City
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label mb-1 small">Search (name or zip)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. Houston or 77001"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label mb-1 small">State</label>
              <select
                className="form-select form-select-sm"
                value={stateFilter}
                onChange={(e) => handleStateChange(e.target.value)}
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.abbreviation})</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1 small">Status</label>
              <select
                className="form-select form-select-sm"
                value={activeFilter}
                onChange={(e) => handleActiveChange(e.target.value)}
              >
                <option value="">All</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
            <div className="col-md-2 text-end">
              <span className="text-muted small">{count.toLocaleString()} cities</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm table-hover">
              <thead className="table-light">
                <tr>
                  <th>Zip</th>
                  <th>Name</th>
                  <th>State</th>
                  <th>Timezone</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No cities found.</td></tr>
                ) : (
                  items.map((city) => (
                    <CityRow key={city.id} city={city} onChanged={() => setTick((t) => t + 1)} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="text-muted small">
                Page {page} of {totalPages}
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  className="btn btn-outline-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <i className="bi bi-chevron-left" /> Previous
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
