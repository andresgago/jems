import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { driversService } from '../../services/drivers';
import { rtlService } from '../../services/rtl';
import { usersService } from '../../services/users';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function LoadCell({ load }) {
  if (!load) return <span className="text-muted">—</span>;
  return (
    <div>
      <div>
        <strong>{load.number}</strong>
        {load.trailer_type && (
          <span className="text-muted ms-1">({load.trailer_type})</span>
        )}
        <br />
        <small className="text-muted">({formatMoney(load.payment)})</small>
      </div>
      <div className="d-flex align-items-start gap-2 mt-1">
        <div className="small text-nowrap">
          {load.pickup_city ? (
            <>
              <div>
                {load.pickup_city} ({load.pickup_state})
                <span className="text-muted ms-1">{load.pickup_zip}</span>
              </div>
              <div className="text-muted">{formatDate(load.pickup_date)}</div>
            </>
          ) : '—'}
        </div>
        <i className="bi bi-arrow-right fs-5 flex-shrink-0 mt-1" />
        <div className="small text-nowrap">
          {load.dropoff_city ? (
            <>
              <div>
                {load.dropoff_city} ({load.dropoff_state})
                <span className="text-muted ms-1">{load.dropoff_zip}</span>
              </div>
              <div className="text-muted">{formatDate(load.dropoff_date)}</div>
            </>
          ) : '—'}
        </div>
      </div>
    </div>
  );
}

function DriverCell({ row }) {
  const load = row.last_load;
  const truck = load?.truck ?? null;
  const trailer = load?.trailer ?? null;
  const trailerType = load?.trailer_type ?? null;

  const truckLabel = truck ?? '(-)';
  const trailerLabel =
    trailer
      ? `${trailer}${trailerType ? ` (${trailerType})` : ''}`
      : '(-)';

  return (
    <div>
      <Link
        to={`/fleet/drivers/${row.id}`}
        className="text-primary fw-semibold text-decoration-none"
      >
        {row.full_name}
      </Link>
      <div className="small text-muted mt-1">
        {truckLabel} — {trailerLabel}
      </div>
    </div>
  );
}

function LocationCell({ location }) {
  if (!location) return <span className="text-muted">—</span>;
  const label = location.calculated || location.state;
  if (!label && !location.timestamp) return <span className="text-muted">—</span>;
  return (
    <div className="small">
      {label && <span>{label}</span>}
      {location.timestamp && (
        <span className="text-muted ms-1">({formatDate(location.timestamp)})</span>
      )}
    </div>
  );
}

const COL_COUNT = 6;
const PAGE_SIZE = 15;

export default function DriversLastLoadsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [dispatchers, setDispatchers] = useState([]);
  const [dispatcherId, setDispatcherId] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  useEffect(() => {
    usersService
      .options({ dispatchers: true })
      .then((res) => setDispatchers(res.data))
      .catch(() => {});
  }, []);

  function fetchRows() {
    setLoading(true);
    setError('');
    setSelected(new Set());
    setPage(1);
    const params = dispatcherId ? { dispatcher_id: dispatcherId } : undefined;
    driversService
      .lastLoads(params)
      .then((res) => setRows(res.data))
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchRows, [dispatcherId]);

  async function handleUpdateLocation() {
    if (!window.confirm("Are you sure you want to update driver's location?")) return;
    setUpdatingLocation(true);
    try {
      await rtlService.fetchAndSync();
      fetchRows();
      window.alert("Driver's location updated successfully!");
    } catch {
      window.alert("Driver's location could not be updated. Please try again.");
    } finally {
      setUpdatingLocation(false);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected].filter((id) => filteredIds.includes(id));
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${ids.length} selected driver${ids.length !== 1 ? 's' : ''}?`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await driversService.bulkDelete(ids);
      fetchRows();
    } catch {
      setError('Failed to delete selected drivers.');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = rows.filter((r) =>
    r.full_name.toLowerCase().includes(filter.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const filteredIds = filtered.map((r) => r.id);
  const paginatedIds = paginated.map((r) => r.id);
  const allSelected =
    paginatedIds.length > 0 && paginatedIds.every((id) => selected.has(id));
  const someSelected = paginatedIds.some((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        paginatedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...paginatedIds]));
    }
  }

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCount = filteredIds.filter((id) => selected.has(id)).length;

  const itemCountLabel = loading
    ? 'Loading…'
    : filtered.length === 0
      ? '0 items.'
      : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length} item${filtered.length !== 1 ? 's' : ''}.`;

  return (
    <div className="drivers-last-loads-page">
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="card loads-grid-card">
        <div className="card-header loads-grid-heading">
          <h5><i className="bi bi-people-fill me-2" />Drivers — Last Loads</h5>
          <span>{itemCountLabel}</span>
        </div>

        <div className="loads-grid-toolbar">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <label className="form-label mb-0 text-muted small">Dispatcher</label>
              <select
                className="form-select form-select-sm"
                style={{ minWidth: 220 }}
                value={dispatcherId}
                onChange={(e) => setDispatcherId(e.target.value)}
                aria-label="Filter by dispatcher"
              >
                <option value="">Show all</option>
                {dispatchers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name ?? d.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="d-flex align-items-center gap-2">
              <label className="form-label mb-0 text-muted small">Driver</label>
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ minWidth: 200 }}
                placeholder="Filter by driver name…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="ms-auto btn-group btn-group-sm">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleUpdateLocation}
              disabled={updatingLocation}
            >
              {updatingLocation
                ? <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />Updating...</>
                : <><i className="bi bi-geo-alt-fill me-1" />Update location</>}
            </button>
          </div>
        </div>

        <div className="table-responsive loads-table-wrap">
          <table className="table table-sm table-hover table-striped align-middle loads-table mb-0">
            <thead>
              <tr>
                <th style={{ width: 30 }} className="text-center">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label="Select all"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th style={{ width: 36 }} className="text-center">#</th>
                <th style={{ width: 160 }}>Driver</th>
                <th>Last Load</th>
                <th>Current Load</th>
                <th style={{ width: 180 }}>Current Location</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center text-muted py-4">
                    No results found.
                  </td>
                </tr>
              )}
              {!loading && paginated.map((row, idx) => (
                <tr
                  key={row.id}
                  className={selected.has(row.id) ? 'table-active' : ''}
                >
                  <td className="text-center align-top">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      aria-label={`Select ${row.full_name}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  <td className="text-center text-muted align-top">{pageStart + idx + 1}</td>
                  <td className="align-top">
                    <DriverCell row={row} />
                  </td>
                  <td className="align-top">
                    <LoadCell load={row.last_load} />
                  </td>
                  <td className="align-top">
                    <LoadCell load={row.current_load} />
                  </td>
                  <td className="align-top">
                    <LocationCell location={row.location} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="loads-bulk-bar">
          <span><i className="bi bi-arrow-right me-2" />With selected</span>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            disabled={!someSelected || deleting}
            onClick={handleBulkDelete}
          >
            <i className="bi bi-trash me-1" />Delete All
          </button>
          {selectedCount > 0 && (
            <span className="text-muted small ms-2">({selectedCount} selected)</span>
          )}
          {totalPages > 1 && (
            <div className="loads-pagination ms-auto">
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                disabled={safePage <= 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <span>Page {safePage} of {totalPages}</span>
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                disabled={safePage >= totalPages}
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
