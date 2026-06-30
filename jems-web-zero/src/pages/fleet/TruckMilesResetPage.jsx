import { useState, useEffect, useCallback, useMemo } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { milesResetService } from '../../services/milesReset';
import { trucksService, TRUCK_STATUS } from '../../services/trucks';

const pad = (value) => String(value).padStart(2, '0');

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function defaultResetDateTime() {
  return `${todayDate()}T00:00`;
}

function formatResetDate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value} 00:00:00`;
  return value.slice(0, 19).replace('T', ' ');
}

function toDateTimeLocal(value) {
  if (!value) return defaultResetDateTime();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
  return value.slice(0, 16);
}

function buildPayloadDate(value) {
  if (!value) return value;
  return value.length === 16 ? `${value}:00` : value;
}

function truckLabelFromReset(reset, trucks) {
  const truck = trucks.find((t) => t.id === reset.truck);
  const number = reset.truck_number || truck?.number || String(reset.truck);
  const vin = reset.truck_vin || truck?.vin || '';
  return vin ? `${number} - ${vin}` : number;
}

function statusForReset(reset, trucks) {
  const truck = trucks.find((t) => t.id === reset.truck);
  const status = reset.truck_status ?? truck?.status;
  return TRUCK_STATUS[status] || { label: 'Unknown', cls: 'secondary' };
}

function ResetFormPanel({
  mode,
  trucks,
  formTruck,
  formDate,
  formError,
  trucksError,
  saving,
  selectedReset,
  onTruckChange,
  onDateChange,
  onCancel,
  onSubmit,
}) {
  if (!mode) return null;

  const isView = mode === 'view';
  const title = mode === 'create'
    ? 'Create New Truck Miles Reset'
    : mode === 'edit'
      ? `Update Miles Reset #${selectedReset?.id}`
      : `Truck Miles Reset #${selectedReset?.id}`;

  return (
    <div className="border-bottom bg-light px-3 py-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="fw-semibold">{title}</div>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onCancel}>
          <i className="bi bi-x-lg" />
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label">Truck <span className="text-danger">*</span></label>
            <select
              className="form-select form-select-sm"
              value={formTruck}
              onChange={(event) => onTruckChange(event.target.value)}
              disabled={isView || Boolean(trucksError)}
            >
              <option value="">Select truck...</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.vin ? `${truck.number} - ${truck.vin}` : truck.number}
                </option>
              ))}
            </select>
            {trucksError && <div className="text-danger small mt-1">{trucksError}</div>}
          </div>
          <div className="col-md-3">
            <label className="form-label">Date <span className="text-danger">*</span></label>
            <input
              type="datetime-local"
              className="form-control form-control-sm"
              value={formDate}
              onChange={(event) => onDateChange(event.target.value)}
              disabled={isView}
            />
          </div>
          {!isView && (
            <div className="col-auto">
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                <i className="bi bi-check-lg me-1" />{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
        {formError && <div className="text-danger small mt-2">{formError}</div>}
      </form>
    </div>
  );
}

function ResetRow({
  reset,
  serialNo,
  trucks,
  selected,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
}) {
  const status = statusForReset(reset, trucks);
  return (
    <tr className={reset.is_last_reset ? '' : 'row-desactivada'}>
      <td className="text-center">
        <input
          type="checkbox"
          className="form-check-input"
          checked={selected}
          onChange={() => onToggleSelect(reset.id)}
          title="Select"
        />
      </td>
      <td className="text-center text-muted small">{serialNo}</td>
      <td className="text-center">
        {reset.is_last_reset && (
          <i className="bi bi-speedometer2 text-success" title="Last Miles Reset" />
        )}
      </td>
      <td className="fw-semibold">{formatResetDate(reset.date)}</td>
      <td>{truckLabelFromReset(reset, trucks)}</td>
      <td>
        <span className={`badge bg-${status.cls}`}>{status.label}</span>
      </td>
      <td className="text-center">
        <div className="d-flex gap-1 justify-content-center">
          <button className="btn btn-sm btn-link p-0 text-info" type="button" title="View" onClick={() => onView(reset)}>
            <i className="bi bi-eye" />
          </button>
          <button className="btn btn-sm btn-link p-0" type="button" title="Update" onClick={() => onEdit(reset)}>
            <i className="bi bi-pencil-fill" />
          </button>
          <button className="btn btn-sm btn-link p-0 text-danger" type="button" title="Delete" onClick={() => onDelete(reset)}>
            <i className="bi bi-trash" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TruckMilesResetPage() {
  const [resets, setResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [trucksError, setTrucksError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateMode, setDateMode] = useState('3');
  const [truckFilter, setTruckFilter] = useState('');

  const [formMode, setFormMode] = useState(null);
  const [selectedReset, setSelectedReset] = useState(null);
  const [formTruck, setFormTruck] = useState('');
  const [formDate, setFormDate] = useState(defaultResetDateTime());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (from, to, mode) => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const params = { search: mode };
      if (mode === '1') {
        if (from) params.date_from = from;
        if (to) params.date_to = to;
      }
      const response = await milesResetService.list(params);
      setResets(Array.isArray(response.data) ? response.data : response.data.results || []);
    } catch {
      setError('Error loading miles reset records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('', '', '3'); }, [load]);

  useEffect(() => {
    trucksService.options()
      .then((response) => setTrucks(Array.isArray(response.data) ? response.data : response.data.results || []))
      .catch(() => setTrucksError('Error loading truck options. Check that the backend is running.'));
  }, []);

  const filtered = useMemo(() => {
    if (!truckFilter) return resets;
    return resets.filter((reset) => String(reset.truck) === truckFilter);
  }, [resets, truckFilter]);

  const allSelected = filtered.length > 0 && filtered.every((reset) => selectedIds.has(reset.id));

  const closeForm = () => {
    setFormMode(null);
    setSelectedReset(null);
    setFormTruck('');
    setFormDate(defaultResetDateTime());
    setFormError('');
  };

  const openCreate = () => {
    setSelectedReset(null);
    setFormMode('create');
    setFormTruck('');
    setFormDate(defaultResetDateTime());
    setFormError('');
  };

  const openExisting = (mode, reset) => {
    setSelectedReset(reset);
    setFormMode(mode);
    setFormTruck(String(reset.truck));
    setFormDate(toDateTimeLocal(reset.date));
    setFormError('');
  };

  const handleSearch = (event) => {
    event.preventDefault();
    load(dateFrom, dateTo, dateMode);
  };

  const handleResetGrid = () => {
    setDateFrom('');
    setDateTo('');
    setDateMode('3');
    setTruckFilter('');
    closeForm();
    load('', '', '3');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formTruck) { setFormError('Select a truck.'); return; }
    if (!formDate) { setFormError('Date is required.'); return; }
    if (trucksError) { setFormError(trucksError); return; }

    setSaving(true);
    setFormError('');
    try {
      const payload = { truck: Number(formTruck), date: buildPayloadDate(formDate) };
      if (formMode === 'edit' && selectedReset) {
        await milesResetService.update(selectedReset.id, payload);
      } else {
        await milesResetService.create(payload);
      }
      closeForm();
      await load(dateFrom, dateTo, dateMode);
    } catch (err) {
      const data = err?.response?.data;
      setFormError(data?.date?.[0] || data?.date || data?.detail || 'Error saving reset record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reset) => {
    if (!window.confirm(`Delete miles reset record for ${truckLabelFromReset(reset, trucks)} on ${formatResetDate(reset.date)}?`)) return;
    try {
      await milesResetService.destroy(reset.id);
      await load(dateFrom, dateTo, dateMode);
    } catch {
      alert('Error deleting record.');
    }
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((reset) => reset.id)));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected reset record(s)?`)) return;
    setBulkDeleting(true);
    try {
      await milesResetService.bulkDelete(Array.from(selectedIds));
      await load(dateFrom, dateTo, dateMode);
    } catch {
      setError('Error deleting selected records.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const COL_COUNT = 7;

  return (
    <div>
      <form className="load-search-band" style={{ gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 320px) 136px' }} onSubmit={handleSearch}>
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
          <label>Filter by Date</label>
          <select className="form-select form-select-sm" value={dateMode} onChange={(event) => setDateMode(event.target.value)}>
            <option value="1">By date</option>
            <option value="3">Show all (Ignore dates)</option>
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
            <i className="bi bi-list-ul me-2" />Trucks Miles Reset Listing
          </h5>
          <span>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}.</span>
        </div>

        <div className="loads-grid-toolbar">
          <div className="ms-auto btn-group btn-group-sm">
            <button className="btn btn-primary" type="button" onClick={openCreate}>
              <i className="bi bi-plus-lg me-1" />New Truck Miles Reset
            </button>
            <button className="btn btn-success" type="button" title="Reset Grid" onClick={handleResetGrid}>
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
        </div>

        <ResetFormPanel
          mode={formMode}
          trucks={trucks}
          formTruck={formTruck}
          formDate={formDate}
          formError={formError}
          trucksError={trucksError}
          saving={saving}
          selectedReset={selectedReset}
          onTruckChange={setFormTruck}
          onDateChange={setFormDate}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />

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
                  <i className="bi bi-speedometer2" title="Last Miles Reset" />
                </th>
                <th style={{ width: 210 }}>Date</th>
                <th>
                  <label>Truck</label>
                  <select
                    className="form-select form-select-sm"
                    value={truckFilter}
                    onChange={(event) => setTruckFilter(event.target.value)}
                  >
                    <option value="">Truck</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>{truck.number}</option>
                    ))}
                  </select>
                </th>
                <th style={{ width: 110 }}>Status</th>
                <th className="text-center" style={{ width: 120 }}>Actions</th>
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
                  <td colSpan={COL_COUNT} className="text-center py-4 text-muted">No results found.</td>
                </tr>
              )}
              {!loading && filtered.map((reset, index) => (
                <ResetRow
                  key={reset.id}
                  reset={reset}
                  serialNo={index + 1}
                  trucks={trucks}
                  selected={selectedIds.has(reset.id)}
                  onToggleSelect={toggleSelectOne}
                  onView={(item) => openExisting('view', item)}
                  onEdit={(item) => openExisting('edit', item)}
                  onDelete={handleDelete}
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
            <i className="bi bi-trash me-1" />Delete All
          </button>
        </div>
      </section>
    </div>
  );
}
