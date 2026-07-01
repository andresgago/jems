import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import DateRangePicker from '../../components/DateRangePicker';
import { accidentsService } from '../../services/accidents';
import { trucksService } from '../../services/trucks';
import { trailersService } from '../../services/trailers';
import { driversService } from '../../services/drivers';

const DATE_TYPE_OPTIONS = [
  { value: '3', label: 'Show all (Ignore dates)' },
  { value: '1', label: 'Show by date' },
];

function PictureBadge({ count, accidentId }) {
  if (count > 0) {
    return (
      <Link to={`/fleet/accidents/${accidentId}`} className="badge bg-success text-decoration-none" title="View pictures">
        {count}
      </Link>
    );
  }
  return <span className="badge bg-secondary">0</span>;
}

function UploadPictureButton({ accidentId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await accidentsService.addPicture(accidentId, file);
      onUploaded();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <label className="btn btn-sm btn-link p-0 text-secondary" title="Upload picture" style={{ cursor: 'pointer' }}>
      {uploading
        ? <span className="spinner-border spinner-border-sm" />
        : <i className="bi bi-camera" />}
      <input ref={inputRef} type="file" accept="image/*" className="d-none" onChange={handleChange} disabled={uploading} />
    </label>
  );
}

function AccidentRow({ accident, serialNo, selected, onToggleSelect, onDeleted, onPictureUploaded }) {
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

  const dateStr = accident.date
    ? new Date(accident.date).toLocaleString()
    : '—';

  return (
    <tr>
      <td className="text-center">
        <input
          type="checkbox"
          className="form-check-input"
          checked={selected}
          onChange={() => onToggleSelect(accident.id)}
        />
      </td>
      <td className="text-center text-muted small">{serialNo}</td>
      <td className="align-middle">{accident.crash_number || <span className="text-muted">n/a</span>}</td>
      <td className="align-middle small">{dateStr}</td>
      <td className="align-middle">{accident.driver_name || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{accident.truck_number || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{accident.trailer_number || <span className="text-muted">—</span>}</td>
      <td className="align-middle small">{accident.city_name || <span className="text-muted">—</span>}</td>
      <td className="text-center">
        <PictureBadge count={accident.picture_count ?? 0} accidentId={accident.id} />
      </td>
      <td className="text-center">
        <UploadPictureButton accidentId={accident.id} onUploaded={onPictureUploaded} />
      </td>
      <td className="text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link to={`/fleet/accidents/${accident.id}`} className="btn btn-sm btn-link p-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/fleet/accidents/${accident.id}/edit`} className="btn btn-sm btn-link p-0" title="Edit">
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

export default function AccidentsPage() {
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateType, setDateType] = useState('3');

  const [driverFilter, setDriverFilter] = useState('');
  const [truckFilter, setTruckFilter] = useState('');
  const [trailerFilter, setTrailerFilter] = useState('');
  const [crashFilter, setCrashFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async (dFrom, dTo, dType) => {
    setLoading(true);
    setError(null);
    try {
      const params = { date_type: dType };
      if (dType === '1') {
        if (dFrom) params.date_from = dFrom;
        if (dTo) params.date_to = dTo;
      }
      const res = await accidentsService.list(params);
      setAccidents(res.data);
      setSelectedIds(new Set());
    } catch {
      setError('Error loading accidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('', '', '3'); }, [load]);

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
    trailersService.list().then((r) => setTrailers(r.data)).catch(() => {});
    driversService.list().then((r) => setDrivers(r.data)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(dateFrom, dateTo, dateType);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setDateType('3');
    setDriverFilter('');
    setTruckFilter('');
    setTrailerFilter('');
    setCrashFilter('');
    setCityFilter('');
    load('', '', '3');
  };

  const filtered = useMemo(() => {
    let result = accidents;
    if (driverFilter) result = result.filter((a) => String(a.driver) === driverFilter);
    if (truckFilter) result = result.filter((a) => String(a.truck) === truckFilter);
    if (trailerFilter) result = result.filter((a) => String(a.trailer) === trailerFilter);
    const crashQuery = crashFilter.trim().toLowerCase();
    if (crashQuery) {
      result = result.filter((a) => (a.crash_number || '').toLowerCase().includes(crashQuery));
    }
    const cityQuery = cityFilter.trim().toLowerCase();
    if (cityQuery) result = result.filter((a) => (a.city_name || '').toLowerCase().includes(cityQuery));
    return result;
  }, [accidents, driverFilter, truckFilter, trailerFilter, crashFilter, cityFilter]);

  const allSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
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
    if (!window.confirm(`Delete ${selectedIds.size} accident(s)?`)) return;
    setBulkDeleting(true);
    try {
      await accidentsService.bulkDelete(Array.from(selectedIds));
      await load(dateFrom, dateTo, dateType);
    } catch {
      setError('Error deleting selected accidents.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const COL_COUNT = 11;

  return (
    <div>
      <form className="load-search-band" style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr) 136px' }} onSubmit={handleSearch}>
        <div className="load-filter">
          <label>Filter by dates</label>
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
            className="form-select form-select-sm"
            value={dateType}
            onChange={(e) => setDateType(e.target.value)}
          >
            {DATE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
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
            <i className="bi bi-exclamation-triangle me-2" />Accidents
          </h5>
          <span>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</span>
        </div>

        <div className="loads-grid-toolbar">
          <div className="ms-auto btn-group btn-group-sm">
            <Link to="/fleet/accidents/create" className="btn btn-primary">
              <i className="bi bi-plus-lg me-1" />New Accident
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
                <th>
                  <label>FMCSA Crash Report Number</label>
                  <input
                    className="form-control form-control-sm"
                    value={crashFilter}
                    onChange={(e) => setCrashFilter(e.target.value)}
                    placeholder="FMCSA Crash Report Number"
                  />
                </th>
                <th>Date and Time</th>
                <th>
                  <label>Driver</label>
                  <select
                    className="form-select form-select-sm"
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                  >
                    <option value="">Filter by driver</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <label>Truck</label>
                  <select
                    className="form-select form-select-sm"
                    value={truckFilter}
                    onChange={(e) => setTruckFilter(e.target.value)}
                  >
                    <option value="">Filter by truck</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>{t.number}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <label>Trailer</label>
                  <select
                    className="form-select form-select-sm"
                    value={trailerFilter}
                    onChange={(e) => setTrailerFilter(e.target.value)}
                  >
                    <option value="">Filter by trailer</option>
                    {trailers.map((t) => (
                      <option key={t.id} value={t.id}>{t.number}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <label>City</label>
                  <input
                    className="form-control form-control-sm"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder="Filter by city"
                  />
                </th>
                <th className="text-center">View Pictures</th>
                <th className="text-center">Upload Pictures</th>
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
                  <td colSpan={COL_COUNT} className="text-center py-4 text-muted">No accidents found.</td>
                </tr>
              )}
              {!loading && filtered.map((a, idx) => (
                <AccidentRow
                  key={a.id}
                  accident={a}
                  serialNo={idx + 1}
                  selected={selectedIds.has(a.id)}
                  onToggleSelect={toggleSelectOne}
                  onDeleted={() => load(dateFrom, dateTo, dateType)}
                  onPictureUploaded={() => load(dateFrom, dateTo, dateType)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="loads-bulk-bar">
          <span><i className="bi bi-arrow-right me-2" />With selected:</span>
          <button
            className="btn btn-danger btn-sm"
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
