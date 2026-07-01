import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrucks } from '../../hooks/useTrucks';
import { trucksService, TRUCK_STATUS } from '../../services/trucks';
import { usersService } from '../../services/users';
import { mediaUrl } from '../../utils/media';
import {
  TRUCK_REPORT_FIELDS,
  parseTruckReportFields,
  serializeTruckReportFields,
} from './truckReportFields';
import { TRUCK_REPORT_WINDOW_FEATURES } from './truckReportPrintUtils';

function StatusText({ status }) {
  const s = TRUCK_STATUS[status] || { label: status };
  return <span>{s.label}</span>;
}

function ExpDate({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  const expired = new Date(value) < new Date(new Date().toDateString());
  return (
    <div className={expired ? 'text-danger fw-semibold' : ''}>
      {value}
    </div>
  );
}

function DocumentCell({ file, label }) {
  const href = mediaUrl(file);
  if (!href) {
    return <i className="bi bi-file-earmark-fill text-info opacity-50" title={`No ${label} file`} />;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" title={label} className="legacy-document-link">
      <i className="bi bi-file-earmark-arrow-down-fill text-info" />
    </a>
  );
}

function TruckPhoto({ truck }) {
  const src = mediaUrl(truck.photo);
  if (src) return <img src={src} alt="" className="load-driver-photo" />;
  return <div className="load-driver-photo load-driver-photo-empty"><i className="bi bi-truck" /></div>;
}

function TruckRow({ truck, index, selected, onSelect, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const toggle = async () => {
    const message = truck.status === 1
      ? 'Are you sure to deactivate this item?'
      : 'Are you sure to activate this item?';
    if (!window.confirm(message)) return;
    setActioning(true);
    try {
      await trucksService.toggleStatus(truck.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Are you sure to delete this item?')) return;
    await trucksService.destroy(truck.id);
    onChanged();
  };

  return (
    <tr className={truck.status !== 1 ? 'row-desactivada' : ''}>
      <td className="text-center">
        <input
          type="checkbox"
          aria-label={`Select truck ${truck.number}`}
          checked={selected}
          onChange={(event) => onSelect(truck.id, event.target.checked)}
        />
      </td>
      <td className="text-center">{index + 1}</td>
      <td className="text-center"><TruckPhoto truck={truck} /></td>
      <td className="text-center">
        <Link to={`/fleet/trucks/${truck.id}`} className="fw-semibold text-decoration-none">
          {truck.number}
        </Link>
      </td>
      <td className="text-center">{truck.vin || <span className="text-muted">—</span>}</td>
      <td className="text-center">{truck.plate || <span className="text-muted">—</span>}</td>
      <td className="text-center">{truck.transponder || <span className="text-muted">—</span>}</td>
      <td className="text-center document-col"><DocumentCell file={truck.avi_file} label="AVI" /></td>
      <td className="text-center"><ExpDate value={truck.avi_expiration} /></td>
      <td className="text-center document-col"><DocumentCell file={truck.registration_file} label="Registration" /></td>
      <td className="text-center"><ExpDate value={truck.registration_expiration} /></td>
      <td className="text-center"><StatusText status={truck.status} /></td>
      <td className="text-center">{truck.carrier_name || <span className="text-muted">—</span>}</td>
      <td className="text-center">{truck.owner_name || <span className="text-muted">—</span>}</td>
      <td className="text-center">
        <Link className="btn btn-link btn-sm p-0 me-2" to={`/fleet/trucks/${truck.id}`} title="View">
          <i className="bi bi-eye-fill" />
        </Link>
        <Link className="btn btn-link btn-sm p-0 me-2" to={`/fleet/trucks/${truck.id}/edit`} title="Update">
          <i className="bi bi-pencil-fill" />
        </Link>
        <button className="btn btn-link btn-sm p-0 me-2" title="Toggle status" disabled={actioning} onClick={toggle}>
          <i className="bi bi-arrow-repeat" />
        </button>
        <button className="btn btn-link btn-sm p-0 text-danger" title="Delete" onClick={remove}>
          <i className="bi bi-trash-fill" />
        </button>
      </td>
      <td className="text-center print-col">
        <button className="btn btn-link btn-sm p-0" type="button" title="View Truck" onClick={() => window.open(`/print/trucks?ids=${truck.id}`, '_blank', TRUCK_REPORT_WINDOW_FEATURES)}>
          <i className="bi bi-printer-fill" />
        </button>
      </td>
      <td className="text-center avi-action-col">
        <Link className="btn btn-xs btn-outline-success legacy-new-avi-btn" to={`/fleet/trucks/${truck.id}/edit?tab=registration`}>
          New AVI
        </Link>
      </td>
    </tr>
  );
}

const PAGE_SIZE = 50;

const EMPTY_FILTERS = {
  number: '',
  vin: '',
  plate: '',
  transponder: '',
  status: '',
  carrier: '',
  owner: '',
};

export default function TrucksPage() {
  const { trucks, loading, error, refresh } = useTrucks();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState([]);
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [fieldSettings, setFieldSettings] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [page, setPage] = useState(1);

  const carrierOptions = useMemo(() => {
    const values = new Map();
    trucks.forEach((truck) => {
      if (truck.carrier_name) values.set(truck.carrier_name, truck.carrier_name);
    });
    return Array.from(values.values()).sort();
  }, [trucks]);

  const ownerOptions = useMemo(() => {
    const values = new Map();
    trucks.forEach((truck) => {
      if (truck.owner_name) values.set(truck.owner_name, truck.owner_name);
    });
    return Array.from(values.values()).sort();
  }, [trucks]);

  const filtered = useMemo(() => {
    const number = filters.number.trim().toLowerCase();
    const vin = filters.vin.trim().toLowerCase();
    const plate = filters.plate.trim().toLowerCase();
    const transponder = filters.transponder.trim().toLowerCase();
    return trucks.filter((truck) => {
      if (number && !truck.number.toLowerCase().includes(number)) return false;
      if (vin && !(truck.vin || '').toLowerCase().includes(vin)) return false;
      if (plate && !(truck.plate || '').toLowerCase().includes(plate)) return false;
      if (transponder && !(truck.transponder || '').toLowerCase().includes(transponder)) return false;
      if (filters.status !== '' && String(truck.status) !== filters.status) return false;
      if (filters.carrier && truck.carrier_name !== filters.carrier) return false;
      if (filters.owner && truck.owner_name !== filters.owner) return false;
      return true;
    });
  }, [trucks, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const normalizedPage = Math.min(page, pageCount);
  const pageStart = filtered.length ? (normalizedPage - 1) * PAGE_SIZE : 0;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = filtered.length ? pageStart + pageRows.length : 0;

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const selectedSet = new Set(selected);
  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const selectAll = (checked) => {
    const pageIds = pageRows.map((truck) => truck.id);
    setSelected((current) => {
      if (checked) return Array.from(new Set([...current, ...pageIds]));
      return current.filter((id) => !pageIds.includes(id));
    });
  };

  const selectOne = (id, checked) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm('Are you sure to delete this item?')) return;
    await Promise.all(selected.map((id) => trucksService.destroy(id)));
    setSelected([]);
    refresh();
  };

  const openTrucksReport = () => {
    if (!selected.length) {
      window.alert('Please select some trucks to show');
      return;
    }
    window.open(`/print/trucks?ids=${encodeURIComponent(selected.join(','))}`, '_blank', TRUCK_REPORT_WINDOW_FEATURES);
  };

  const openTrucksExport = () => {
    if (!selected.length) {
      window.alert('Please select some trucks to show');
      return;
    }
    window.open(`/print/trucks/export?ids=${encodeURIComponent(selected.join(','))}`, '_blank', TRUCK_REPORT_WINDOW_FEATURES);
  };

  const openFieldSettings = async () => {
    setShowFieldSettings(true);
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const response = await usersService.getDisplayOptions();
      setFieldSettings(parseTruckReportFields(response.data.truck));
    } catch {
      setSettingsError('Error loading truck report fields.');
      setFieldSettings(parseTruckReportFields(''));
    } finally {
      setSettingsLoading(false);
    }
  };

  const toggleFieldSetting = (key, checked) => {
    setFieldSettings((current) => (
      checked ? [...current, key] : current.filter((field) => field !== key)
    ));
  };

  const saveFieldSettings = async () => {
    setSettingsSaving(true);
    setSettingsError('');
    try {
      await usersService.updateDisplayOptions({ truck: serializeTruckReportFields(fieldSettings) });
      setShowFieldSettings(false);
    } catch {
      setSettingsError('Error saving truck report fields.');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="legacy-grid-page">
      <div className="legacy-grid-title">
        <h5><i className="bi bi-list me-1" />Trucks</h5>
        <span>Showing {filtered.length ? pageStart + 1 : 0}-{pageEnd} of {filtered.length} items.</span>
      </div>

      <div className="legacy-grid-toolbar">
        <button className="btn btn-sm btn-success" type="button" title="Import">
          <i className="bi bi-upload me-1" />Import
        </button>
        <Link to="/fleet/trucks/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />New Truck
        </Link>
        <button className="btn btn-sm btn-success" type="button" onClick={openTrucksReport} title="Trucks Report">
          <i className="bi bi-printer-fill me-1" />Trucks Report
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={openTrucksExport} title="Trucks Export">
          <i className="bi bi-file-earmark-spreadsheet-fill" />
        </button>
        <button className="btn btn-sm btn-info text-white" type="button" onClick={openFieldSettings} title="Setting Fields For Reports">
          <i className="bi bi-gear-fill" />
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={refresh} title="Reset Grid">
          <i className="bi bi-arrow-clockwise" />
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={() => { setFilters(EMPTY_FILTERS); setSelected([]); }}>
          <i className="bi bi-check2-all me-1" />All
        </button>
      </div>

      {error && <div className="alert alert-danger mb-0">Error loading trucks.</div>}

      <div className="legacy-grid-wrap">
        <table className="table table-sm table-hover mb-0 legacy-grid-table trucks-grid-table">
          <thead>
            <tr>
              <th className="select-col">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={pageRows.length > 0 && pageRows.every((truck) => selectedSet.has(truck.id))}
                  onChange={(event) => selectAll(event.target.checked)}
                />
              </th>
              <th className="serial-col">#</th>
              <th className="driver-photo-col"><i className="bi bi-image-fill" /></th>
              <th>Number</th>
              <th>Vin number</th>
              <th>Plate</th>
              <th>Transponder</th>
              <th>AVI</th>
              <th>AVI expiration date</th>
              <th>Registration</th>
              <th>Registration expiration date</th>
              <th>Status</th>
              <th>Carrier</th>
              <th>Owner</th>
              <th>Actions</th>
              <th><i className="bi bi-printer-fill" /></th>
              <th>AVI</th>
            </tr>
            <tr className="legacy-filter-row">
              <th />
              <th />
              <th />
              <th>
                <input className="form-control form-control-sm" placeholder="Find by number" value={filters.number} onChange={(event) => setFilter('number', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by Vin number" value={filters.vin} onChange={(event) => setFilter('vin', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by plate" value={filters.plate} onChange={(event) => setFilter('plate', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by transponder" value={filters.transponder} onChange={(event) => setFilter('transponder', event.target.value)} />
              </th>
              <th />
              <th />
              <th />
              <th />
              <th>
                <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                  <option value="">...</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.carrier} onChange={(event) => setFilter('carrier', event.target.value)}>
                  <option value="">Filter by carrier</option>
                  {carrierOptions.map((carrier) => <option key={carrier} value={carrier}>{carrier}</option>)}
                </select>
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.owner} onChange={(event) => setFilter('owner', event.target.value)}>
                  <option value="">Filter by owner operator</option>
                  {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                </select>
              </th>
              <th />
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={17} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>}
            {!loading && !error && filtered.length === 0 && <tr><td colSpan={17} className="text-center text-muted py-4">No trucks found.</td></tr>}
            {!loading && pageRows.map((truck, index) => (
              <TruckRow
                key={truck.id}
                truck={truck}
                index={pageStart + index}
                selected={selectedSet.has(truck.id)}
                onSelect={selectOne}
                onChanged={refresh}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="legacy-grid-footer">
        <i className="bi bi-arrow-right" />
        <span>With selected</span>
        <button className="btn btn-danger btn-xs" type="button" disabled={!selected.length} onClick={bulkDelete}>
          <i className="bi bi-trash-fill me-1" />Delete All
        </button>
      </div>
      <div className="legacy-grid-pagination">
        <button className="btn btn-xs btn-light" type="button" disabled={normalizedPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          &laquo;
        </button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            className={`btn btn-xs ${pageNumber === normalizedPage ? 'btn-primary' : 'btn-light'}`}
            type="button"
            onClick={() => setPage(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button className="btn btn-xs btn-light" type="button" disabled={normalizedPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
          &raquo;
        </button>
      </div>

      {showFieldSettings && (
        <div className="legacy-report-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="truck-report-fields-title">
          <div className="legacy-report-modal">
            <div className="legacy-report-modal-header">
              <h5 id="truck-report-fields-title"><i className="bi bi-gear-fill me-1" />Truck Fields Check For Reports</h5>
              <button className="btn btn-link legacy-report-modal-close" type="button" onClick={() => setShowFieldSettings(false)} aria-label="Close">&times;</button>
            </div>
            <div className="legacy-report-modal-body">
              {settingsError && <div className="alert alert-danger py-2">{settingsError}</div>}
              <table className="table table-sm table-hover mb-0 legacy-grid-table driver-report-fields-table">
                <thead>
                  <tr>
                    <th colSpan={2} className="text-center">Truck Fields</th>
                  </tr>
                  <tr>
                    <th className="text-center">#</th>
                    <th>Field</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsLoading && (
                    <tr><td colSpan={2} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>
                  )}
                  {!settingsLoading && TRUCK_REPORT_FIELDS.map((field) => (
                    <tr key={field.key}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`Report field ${field.label}`}
                          checked={fieldSettings.includes(field.key)}
                          onChange={(event) => toggleFieldSetting(field.key, event.target.checked)}
                        />
                      </td>
                      <td className="fw-semibold">{field.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legacy-report-modal-footer">
              <button className="btn btn-sm btn-success" type="button" onClick={() => setShowFieldSettings(false)}>Close</button>
              <button className="btn btn-sm btn-primary" type="button" onClick={saveFieldSettings} disabled={settingsSaving || settingsLoading}>
                {settingsSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
