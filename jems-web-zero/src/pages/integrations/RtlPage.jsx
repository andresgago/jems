import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRtlDrivers } from '../../hooks/useRtlDrivers';
import { useRtlTrucks } from '../../hooks/useRtlTrucks';
import { getHosStatus } from '../../services/rtl';

function HosBadge({ code }) {
  const s = getHosStatus(code);
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function ActiveBadge({ active }) {
  return active
    ? <span className="badge bg-success">Active</span>
    : <span className="badge bg-secondary">Inactive</span>;
}

function DriversTab() {
  const { items, loading, error } = useRtlDrivers();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((d) => {
      if (activeFilter !== '' && String(d.active) !== activeFilter) return false;
      const name = `${d.first_name} ${d.last_name}`.toLowerCase();
      if (q && !name.includes(q) && !d.license_number.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, activeFilter]);

  return (
    <div>
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Name or license…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">Error loading RTL drivers.</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>License #</th>
                  <th>State</th>
                  <th>Phone</th>
                  <th className="text-center">HOS Status</th>
                  <th className="text-center">ELD</th>
                  <th className="text-center">Active</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No RTL drivers found.</td></tr>
                )}
                {!loading && filtered.map((d) => (
                  <tr key={d.id}>
                    <td className="align-middle fw-semibold">
                      {d.first_name} {d.last_name}
                    </td>
                    <td className="align-middle small">{d.license_number || <span className="text-muted">—</span>}</td>
                    <td className="align-middle">{d.license_state || <span className="text-muted">—</span>}</td>
                    <td className="align-middle small">{d.phone_num || <span className="text-muted">—</span>}</td>
                    <td className="align-middle text-center">
                      {d.latest_status
                        ? <HosBadge code={d.latest_status.hos_event_code} />
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="align-middle text-center small text-muted">
                      {d.latest_status?.vehicle_vin
                        ? <span title={d.latest_status.vehicle_vin}>{d.latest_status.vehicle_vin.slice(-6)}</span>
                        : '—'}
                    </td>
                    <td className="align-middle text-center"><ActiveBadge active={d.active} /></td>
                    <td className="align-middle text-center">
                      <Link to={`/rtl/drivers/${d.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
                        <i className="bi bi-eye" />
                      </Link>
                    </td>
                  </tr>
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

function TrucksTab() {
  const { items, loading, error } = useRtlTrucks();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((t) => {
      if (activeFilter !== '' && String(t.active) !== activeFilter) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.vin.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, activeFilter]);

  return (
    <div>
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Name or VIN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">Error loading RTL trucks.</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>VIN</th>
                  <th>Year</th>
                  <th>Make / Model</th>
                  <th>Plate</th>
                  <th className="text-center">Speed</th>
                  <th className="text-center">Active</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No RTL trucks found.</td></tr>
                )}
                {!loading && filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="align-middle fw-semibold">{t.name}</td>
                    <td className="align-middle small">{t.vin}</td>
                    <td className="align-middle">{t.year || <span className="text-muted">—</span>}</td>
                    <td className="align-middle small">
                      {[t.make, t.model].filter(Boolean).join(' ') || <span className="text-muted">—</span>}
                    </td>
                    <td className="align-middle">{t.plate_number || <span className="text-muted">—</span>}</td>
                    <td className="align-middle text-center small">
                      {t.latest_status?.speed != null
                        ? `${Math.round(t.latest_status.speed)} mph`
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="align-middle text-center"><ActiveBadge active={t.active} /></td>
                    <td className="align-middle text-center">
                      <Link to={`/rtl/trucks/${t.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
                        <i className="bi bi-eye" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot>
                  <tr className="table-secondary">
                    <td colSpan={8} className="small text-muted ps-2">
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

export default function RtlPage() {
  const [tab, setTab] = useState('drivers');

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-journal-text me-2" />RTL / ELD
        </h5>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${tab === 'drivers' ? 'active' : ''}`}
            onClick={() => setTab('drivers')}
          >
            <i className="bi bi-people me-1" />Drivers
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === 'trucks' ? 'active' : ''}`}
            onClick={() => setTab('trucks')}
          >
            <i className="bi bi-truck me-1" />Trucks
          </button>
        </li>
      </ul>

      {tab === 'drivers' ? <DriversTab /> : <TrucksTab />}
    </div>
  );
}
