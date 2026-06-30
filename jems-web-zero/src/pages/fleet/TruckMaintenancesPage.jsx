import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DateRangePicker from '../../components/DateRangePicker';
import { truckMaintenanceService } from '../../services/truckMaintenance';
import { trucksService } from '../../services/trucks';

function AlertBadge({ enabled, threshold, unit }) {
  if (!enabled) return <span className="text-muted small">—</span>;
  return (
    <span className="badge bg-warning text-dark">
      <i className="bi bi-bell-fill me-1" />
      {threshold.toLocaleString()} {unit}
    </span>
  );
}

function TimeAlertBadge({ enabled, years, months }) {
  if (!enabled) return <span className="text-muted small">—</span>;
  const parts = [];
  if (years > 0) parts.push(`${years} yr`);
  if (months > 0) parts.push(`${months} mo`);
  return (
    <span className="badge bg-warning text-dark">
      <i className="bi bi-clock-fill me-1" />{parts.join(' ') || '—'}
    </span>
  );
}

function StatusBadge({ isDone }) {
  if (isDone) {
    return (
      <span className="badge bg-success">
        <i className="bi bi-check-circle-fill me-1" />Done
      </span>
    );
  }
  return (
    <span className="badge bg-secondary">
      <i className="bi bi-activity me-1" />Current
    </span>
  );
}

function OdometerCell({ prev, current, traveled }) {
  if (!prev && !current && !traveled) return <span className="text-muted small">—</span>;
  return (
    <div className="small">
      <div>Previous: {(prev || 0).toLocaleString()}</div>
      <div>Current: {(current || 0).toLocaleString()}</div>
      <div className="text-muted">Traveled: {(traveled || 0).toLocaleString()}</div>
    </div>
  );
}

function MaintenanceRow({ record, serialNo, isLatest, selected, onToggleSelect, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete maintenance record for truck ${record.truck_number} on ${record.date}?`)) return;
    setDeleting(true);
    try {
      await truckMaintenanceService.destroy(record.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr className={isLatest ? '' : 'text-muted'}>
      <td className="text-center">
        <input
          type="checkbox"
          className="form-check-input"
          checked={selected}
          onChange={() => onToggleSelect(record.id)}
          title="Select"
        />
      </td>
      <td className="text-center text-muted small">{serialNo}</td>
      <td className="text-center">
        {isLatest && (
          <i
            className="bi bi-wrench-adjustable-circle-fill text-success"
            title="Latest maintenance for this truck"
          />
        )}
      </td>
      <td className="text-center small">
        <Link to={`/fleet/trucks/${record.truck}`} className="text-decoration-none text-muted">
          {record.id}
        </Link>
      </td>
      <td className="fw-semibold">{record.date}</td>
      <td>
        <Link to={`/fleet/trucks/${record.truck}`} className="text-decoration-none">
          {record.truck_number}
        </Link>
        {record.truck_vin ? ` - ${record.truck_vin}` : ''}
      </td>
      <td><StatusBadge isDone={record.is_done} /></td>
      <td><AlertBadge enabled={record.miles_alert} threshold={record.maintenance_miles} unit="mi" /></td>
      <td><TimeAlertBadge enabled={record.time_alert} years={record.time_year} months={record.time_month} /></td>
      <td>
        <OdometerCell
          prev={record.odometer_start}
          current={record.odometer_current}
          traveled={record.driven_miles}
        />
      </td>
      <td className="text-end small">
        {record.truck_odometer_current != null
          ? record.truck_odometer_current.toLocaleString()
          : <span className="text-muted">—</span>}
      </td>
      <td className="text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/fleet/trucks/${record.truck}`}
            className="btn btn-sm btn-link p-0 text-info"
            title="View truck"
          >
            <i className="bi bi-eye" />
          </Link>
          <Link
            to={`/fleet/truck-maintenance/${record.id}/edit`}
            className="btn btn-sm btn-link p-0"
            title="Edit"
          >
            <i className="bi bi-pencil-fill" />
          </Link>
          <button
            className="btn btn-sm btn-link p-0 text-danger"
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

export default function TruckMaintenancesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Top band filters (require Search to apply)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Inline header filters (instant client-side)
  const [idFilter, setIdFilter] = useState('');
  const [truckFilter, setTruckFilter] = useState('');

  const load = useCallback(async (from, to) => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const params = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const res = await truckMaintenanceService.list(params);
      setRecords(res.data);
    } catch {
      setError('Error loading truck maintenance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('', ''); }, [load]);

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(dateFrom, dateTo);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setIdFilter('');
    setTruckFilter('');
    load('', '');
  };

  // Latest maintenance record per truck (highest date, then id)
  const latestIdByTruck = useMemo(() => {
    const map = {};
    for (const r of records) {
      const prev = map[r.truck];
      if (!prev || r.date > prev.date || (r.date === prev.date && r.id > prev.id)) {
        map[r.truck] = r;
      }
    }
    const ids = new Set();
    for (const r of Object.values(map)) ids.add(r.id);
    return ids;
  }, [records]);

  const filtered = useMemo(() => {
    let result = records;
    if (idFilter.trim()) {
      result = result.filter((r) => String(r.id).includes(idFilter.trim()));
    }
    if (truckFilter) {
      result = result.filter((r) => String(r.truck) === truckFilter);
    }
    return result;
  }, [records, idFilter, truckFilter]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected record(s)?`)) return;
    setBulkDeleting(true);
    try {
      await truckMaintenanceService.bulkDelete(Array.from(selectedIds));
      await load(dateFrom, dateTo);
    } catch {
      setError('Error deleting selected records.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const COL_COUNT = 12;

  return (
    <div>
      <form className="load-search-band" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 136px' }} onSubmit={handleSearch}>
        <div className="load-filter">
          <label>Filter by Dates</label>
          <DateRangePicker
            start={dateFrom}
            end={dateTo}
            onApply={({ start, end }) => {
              setDateFrom(start);
              setDateTo(end);
            }}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm load-search-button">
          <i className="bi bi-search me-1" />Search
        </button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="card loads-grid-card">
        <div className="card-header loads-grid-heading">
          <h5 className="mb-0">
            <i className="bi bi-wrench me-2" />Trucks Maintenances
          </h5>
          <span>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}.</span>
        </div>

        <div className="loads-grid-toolbar">
          <div className="ms-auto btn-group btn-group-sm">
            <Link
              to="/fleet/truck-maintenance/create"
              className="btn btn-primary"
              aria-label="New Record - New Truck Maintenance"
            >
              <i className="bi bi-plus-lg me-1" />New Record
            </Link>
          </div>
        </div>

        <div className="table-responsive loads-table-wrap">
          <table className="table table-sm table-hover table-striped align-middle loads-table mb-0">
            <thead>
              <tr className="loads-filter-row">
                <th className="text-center" style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                <th className="text-center" style={{ width: 36 }}>#</th>
                <th className="text-center" style={{ width: 36 }}>
                  <i className="bi bi-wrench" />
                </th>
                <th style={{ width: 80 }}>
                  <label>ID</label>
                  <input
                    className="form-control form-control-sm"
                    value={idFilter}
                    onChange={(e) => setIdFilter(e.target.value)}
                    placeholder="ID"
                  />
                </th>
                <th>Date</th>
                <th>
                  <label>Truck</label>
                  <select
                    className="form-select form-select-sm"
                    value={truckFilter}
                    onChange={(e) => setTruckFilter(e.target.value)}
                  >
                    <option value="">Truck</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>{t.number}</option>
                    ))}
                  </select>
                </th>
                <th>Is Done</th>
                <th>Miles Alert</th>
                <th>Time Alert</th>
                <th>Odometer at maintenance</th>
                <th>Current Odometer</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-4 text-muted">No records found.</td>
                </tr>
              )}
              {!loading &&
                filtered.map((r, idx) => (
                  <MaintenanceRow
                    key={r.id}
                    record={r}
                    serialNo={idx + 1}
                    isLatest={latestIdByTruck.has(r.id)}
                    selected={selectedIds.has(r.id)}
                    onToggleSelect={toggleSelectOne}
                    onDeleted={() => load(dateFrom, dateTo)}
                  />
                ))}
            </tbody>
          </table>
        </div>

        <div className="loads-bulk-bar">
          <span><i className="bi bi-arrow-right me-2" />With selected:</span>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            disabled={selectedIds.size === 0 || bulkDeleting}
            onClick={handleBulkDelete}
          >
            <i className="bi bi-trash me-1" />
            {bulkDeleting ? 'Deleting…' : 'Delete All'}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-muted small">({selectedIds.size} selected)</span>
          )}
          <button className="btn btn-outline-secondary btn-sm ms-auto" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </section>
    </div>
  );
}
