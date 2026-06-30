import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DateRangePicker from '../../components/DateRangePicker';
import { trailerMaintenanceService } from '../../services/trailerMaintenance';
import { trailersService } from '../../services/trailers';

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

const DEFAULT_DATE_SEARCH = '3';
const DEFAULT_DATE_FROM = dateOffset(-7);
const DEFAULT_DATE_TO = dateOffset(0);

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? number.toLocaleString() : number.toLocaleString();
}

function legacyMilesMessage(record) {
  if (record.miles_alert_message) return record.miles_alert_message;
  if (!record.miles_alert) return 'Not Alert';
  if (!record.miles) return 'Not Alert Defined';
  if (!record.is_last_maintenance) return `Inactive alert for ${formatNumber(record.miles)} miles`;
  return `Active alert for ${formatNumber(record.miles)} miles`;
}

function legacyTimeMessage(record) {
  if (record.time_alert_message) return record.time_alert_message;
  if (!record.time_alert) return 'Not Alert';
  const parts = [];
  if (record.time_year > 0) parts.push(`${record.time_year} ${record.time_year === 1 ? 'year' : 'years'}`);
  if (record.time_month > 0) parts.push(`${record.time_month} ${record.time_month === 1 ? 'month' : 'months'}`);
  if (!parts.length) return 'Not Alert Defined';
  const label = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];
  return record.is_last_maintenance ? `Active alert for ${label}` : `Inactive alert for ${label}`;
}

function MaintenanceRow({ record, serialNo, selected, onToggleSelect, onDeleted }) {
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
    <tr className={record.is_last_maintenance ? '' : 'row-desactivada'}>
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
        {record.is_last_maintenance && (
          <i className="bi bi-wrench-adjustable-circle-fill text-danger" title="Last Maintenance" />
        )}
      </td>
      <td className="text-center small">
        <Link to={`/fleet/trailers/${record.trailer}`} className="text-decoration-none text-muted">
          {record.id}
        </Link>
      </td>
      <td className="fw-semibold">{record.date}</td>
      <td>
        <Link to={`/fleet/trailers/${record.trailer}`} className="text-decoration-none">
          {record.trailer_number || 'Not assignment'}
        </Link>
        {record.trailer_vin ? ` - ${record.trailer_vin}` : ''}
      </td>
      <td className="text-center">{legacyMilesMessage(record)}</td>
      <td className="text-center">{legacyTimeMessage(record)}</td>
      <td className="text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/fleet/trailers/${record.trailer}`}
            className="btn btn-sm btn-link p-0 text-info"
            title="View trailer"
          >
            <i className="bi bi-eye" />
          </Link>
          <Link
            to={`/fleet/trailer-maintenance/${record.id}/edit`}
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

export default function TrailerMaintenancesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trailers, setTrailers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [dateFrom, setDateFrom] = useState(DEFAULT_DATE_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_DATE_TO);
  const [dateSearch, setDateSearch] = useState(DEFAULT_DATE_SEARCH);

  const [idFilter, setIdFilter] = useState('');
  const [trailerFilter, setTrailerFilter] = useState('');

  const load = useCallback(async (from, to, searchMode) => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const params = { date_search: searchMode };
      if (searchMode === '2') {
        if (from) params.date_from = from;
        if (to) params.date_to = to;
      }
      const res = await trailerMaintenanceService.list(params);
      setRecords(res.data);
    } catch {
      setError('Error loading trailer maintenance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(DEFAULT_DATE_FROM, DEFAULT_DATE_TO, DEFAULT_DATE_SEARCH); }, [load]);

  useEffect(() => {
    trailersService.list().then((r) => setTrailers(r.data)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(dateFrom, dateTo, dateSearch);
  };

  const handleReset = () => {
    const from = dateOffset(-7);
    const to = dateOffset(0);
    setDateFrom(from);
    setDateTo(to);
    setDateSearch(DEFAULT_DATE_SEARCH);
    setIdFilter('');
    setTrailerFilter('');
    load(from, to, DEFAULT_DATE_SEARCH);
  };

  const filtered = useMemo(() => {
    let result = records;
    if (idFilter.trim()) {
      result = result.filter((r) => String(r.id).includes(idFilter.trim()));
    }
    if (trailerFilter) {
      result = result.filter((r) => String(r.trailer) === trailerFilter);
    }
    return result;
  }, [records, idFilter, trailerFilter]);

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
      await trailerMaintenanceService.bulkDelete(Array.from(selectedIds));
      await load(dateFrom, dateTo, dateSearch);
    } catch {
      setError('Error deleting selected records.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const COL_COUNT = 9;

  return (
    <div>
      <form className="load-search-band" style={{ gridTemplateColumns: 'minmax(260px, 480px) minmax(240px, 480px) 112px' }} onSubmit={handleSearch}>
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
        <div className="load-filter">
          <label>Filter by date type search</label>
          <select
            className="form-select"
            style={{ minHeight: 48 }}
            value={dateSearch}
            onChange={(e) => setDateSearch(e.target.value)}
          >
            <option value="3">Show All (Ignore Dates)</option>
            <option value="2">Maintenance Date</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm load-search-button">
          <i className="bi bi-search me-1" />Search
        </button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="card loads-grid-card">
        <div className="card-header loads-grid-heading">
          <h5 className="mb-0">
            <i className="bi bi-list-ul me-2" />Trailer Maintenances
          </h5>
          <span>Showing {filtered.length} {filtered.length === 1 ? 'item' : 'items'}.</span>
        </div>

        <div className="loads-grid-toolbar">
          <div className="ms-auto btn-group btn-group-sm">
            <Link
              to="/fleet/trailer-maintenance/create"
              className="btn btn-primary"
              aria-label="New Trailer Maintenance"
            >
              <i className="bi bi-plus-lg me-1" />New Trailer Maintenance
            </Link>
            <button className="btn btn-success" type="button" onClick={() => load(dateFrom, dateTo, dateSearch)} title="Reset Grid">
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
        </div>

        <div className="table-responsive loads-table-wrap">
          <table className="table table-sm table-hover table-striped align-middle loads-table mb-0" style={{ minWidth: 1180 }}>
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
                  <i className="bi bi-wrench text-danger" title="Last Maintenance" />
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
                <th style={{ width: 110 }}>Date</th>
                <th>
                  <label>Trailer</label>
                  <select
                    className="form-select form-select-sm"
                    value={trailerFilter}
                    onChange={(e) => setTrailerFilter(e.target.value)}
                  >
                    <option value="">Trailer</option>
                    {trailers.map((t) => (
                      <option key={t.id} value={t.id}>{t.number}</option>
                    ))}
                  </select>
                </th>
                <th>Miles Alert</th>
                <th>Time Alert</th>
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
                    selected={selectedIds.has(r.id)}
                    onToggleSelect={toggleSelectOne}
                    onDeleted={() => load(dateFrom, dateTo, dateSearch)}
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
            {bulkDeleting ? 'Deleting...' : 'Delete All'}
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
