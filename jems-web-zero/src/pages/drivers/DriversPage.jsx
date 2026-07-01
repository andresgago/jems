import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDrivers } from '../../hooks/useDrivers';
import { driversService, DRIVER_STATUS } from '../../services/drivers';
import { usersService } from '../../services/users';
import { mediaUrl } from '../../utils/media';
import {
  DRIVER_REPORT_FIELDS,
  parseDriverReportFields,
  serializeDriverReportFields,
} from './driverReportFields';

const REPORT_WINDOW_FEATURES = 'toolbar=yes,scrollbars=yes,menubar=yes';

function StatusText({ status }) {
  const s = DRIVER_STATUS[status] || { label: status };
  return <span>{s.label}</span>;
}

function LicenseCell({ driver }) {
  const expired = driver.license_expiration
    ? new Date(driver.license_expiration) < new Date(new Date().toDateString())
    : false;
  return (
    <div className={expired ? 'text-danger fw-semibold' : ''}>
      {driver.has_license_document && (
        <i className="bi bi-file-earmark-check-fill text-info me-1" title="License file" />
      )}
      <div>{driver.license_expiration || <span className="text-muted">—</span>}</div>
    </div>
  );
}

function DriverPhoto({ driver }) {
  const src = mediaUrl(driver.photo);
  if (src) {
    return <img src={src} alt="" className="load-driver-photo" />;
  }
  return <div className="load-driver-photo load-driver-photo-empty"><i className="bi bi-person" /></div>;
}

function DriverRow({ driver, index, selected, onSelect, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const toggle = async () => {
    if (!window.confirm(`Toggle status for ${driver.full_name}?`)) return;
    setActioning(true);
    try {
      await driversService.toggleStatus(driver.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${driver.full_name}?`)) return;
    await driversService.destroy(driver.id);
    onChanged();
  };

  return (
    <tr className={driver.status !== 1 ? 'row-desactivada' : ''}>
      <td className="text-center">
        <input
          type="checkbox"
          aria-label={`Select ${driver.full_name}`}
          checked={selected}
          onChange={(event) => onSelect(driver.id, event.target.checked)}
        />
      </td>
      <td className="text-center">{index + 1}</td>
      <td className="text-center"><DriverPhoto driver={driver} /></td>
      <td>
        <Link to={`/drivers/${driver.id}`} className="text-decoration-none">
          {driver.full_name}
        </Link>
      </td>
      <td className="text-center">{driver.phone || <span className="text-muted">—</span>}</td>
      <td className="text-center">{driver.driver_type_name || <span className="text-muted">—</span>}</td>
      <td className="text-center"><StatusText status={driver.status} /></td>
      <td className="text-center">{driver.fuel_card_number || <span className="text-muted">—</span>}</td>
      <td className="text-center">{driver.carrier_name || <span className="text-muted">—</span>}</td>
      <td className="text-center"><LicenseCell driver={driver} /></td>
      <td className="text-center">
        <Link className="btn btn-link btn-sm p-0 me-2" to={`/drivers/${driver.id}`} title="View">
          <i className="bi bi-eye-fill" />
        </Link>
        <Link className="btn btn-link btn-sm p-0 me-2" to={`/drivers/${driver.id}/edit`} title="Update">
          <i className="bi bi-pencil-fill" />
        </Link>
        <button className="btn btn-link btn-sm p-0 me-2" title="Toggle status" disabled={actioning} onClick={toggle}>
          <i className="bi bi-arrow-repeat" />
        </button>
        <button className="btn btn-link btn-sm p-0 text-danger" title="Delete" onClick={remove}>
          <i className="bi bi-trash-fill" />
        </button>
      </td>
    </tr>
  );
}

const EMPTY_FILTERS = {
  name: '',
  phone: '',
  type: '',
  status: '',
  card: '',
  carrier: '',
};

export default function DriversPage() {
  const { drivers, loading, error, refresh } = useDrivers();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState([]);
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [fieldSettings, setFieldSettings] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const typeOptions = useMemo(() => {
    const values = new Map();
    drivers.forEach((driver) => {
      if (driver.driver_type_name) values.set(driver.driver_type_name, driver.driver_type_name);
    });
    return Array.from(values.values()).sort();
  }, [drivers]);

  const carrierOptions = useMemo(() => {
    const values = new Map();
    drivers.forEach((driver) => {
      if (driver.carrier_name) values.set(driver.carrier_name, driver.carrier_name);
    });
    return Array.from(values.values()).sort();
  }, [drivers]);

  const filtered = useMemo(() => {
    const name = filters.name.trim().toLowerCase();
    const phone = filters.phone.trim().toLowerCase();
    const card = filters.card.trim().toLowerCase();
    return drivers.filter((driver) => {
      if (name && !driver.full_name.toLowerCase().includes(name)) return false;
      if (phone && !(driver.phone || '').toLowerCase().includes(phone)) return false;
      if (filters.type && driver.driver_type_name !== filters.type) return false;
      if (filters.status !== '' && String(driver.status) !== filters.status) return false;
      if (card && !(driver.fuel_card_number || '').toLowerCase().includes(card)) return false;
      if (filters.carrier && driver.carrier_name !== filters.carrier) return false;
      return true;
    });
  }, [drivers, filters]);

  const setFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const selectedSet = new Set(selected);

  const selectAll = (checked) => {
    setSelected(checked ? filtered.map((driver) => driver.id) : []);
  };

  const selectOne = (id, checked) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected driver${selected.length === 1 ? '' : 's'}?`)) return;
    await driversService.bulkDelete(selected);
    setSelected([]);
    refresh();
  };

  const openDriversReport = () => {
    if (!selected.length) {
      window.alert('Please select some drivers to show');
      return;
    }
    window.open(`/print/drivers?ids=${encodeURIComponent(selected.join(','))}`, '_blank', REPORT_WINDOW_FEATURES);
  };

  const openDriversExport = () => {
    if (!selected.length) {
      window.alert('Please select some drivers to show');
      return;
    }
    window.open(`/print/drivers/export?ids=${encodeURIComponent(selected.join(','))}`, '_blank', REPORT_WINDOW_FEATURES);
  };

  const openFieldSettings = async () => {
    setShowFieldSettings(true);
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const response = await usersService.getDisplayOptions();
      setFieldSettings(parseDriverReportFields(response.data.driver));
    } catch {
      setSettingsError('Error loading driver report fields.');
      setFieldSettings(parseDriverReportFields(''));
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
      await usersService.updateDisplayOptions({ driver: serializeDriverReportFields(fieldSettings) });
      setShowFieldSettings(false);
    } catch {
      setSettingsError('Error saving driver report fields.');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="legacy-grid-page">
      <div className="legacy-grid-title">
        <h5><i className="bi bi-list me-1" />Drivers</h5>
        <span>Showing {filtered.length ? 1 : 0}-{filtered.length} of {drivers.length} items.</span>
      </div>

      <div className="legacy-grid-toolbar">
        <Link to="/drivers/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />New Driver
        </Link>
        <button className="btn btn-sm btn-success" type="button" onClick={openDriversReport} title="Drivers Report">
          <i className="bi bi-printer-fill me-1" />Drivers Report
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={openDriversExport} title="Drivers Export">
          <i className="bi bi-file-earmark-spreadsheet-fill" />
        </button>
        <button className="btn btn-sm btn-info text-white" type="button" onClick={openFieldSettings} title="Setting Fields For Reports">
          <i className="bi bi-gear-fill" />
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={refresh} title="Reset Grid">
          <i className="bi bi-arrow-clockwise" />
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
          <i className="bi bi-check2-all me-1" />All
        </button>
      </div>

      {error && <div className="alert alert-danger mb-0">Error loading drivers.</div>}

      <div className="legacy-grid-wrap">
        <table className="table table-sm table-hover mb-0 legacy-grid-table drivers-grid-table">
          <thead>
            <tr>
              <th className="select-col">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={filtered.length > 0 && selected.length === filtered.length}
                  onChange={(event) => selectAll(event.target.checked)}
                />
              </th>
              <th className="serial-col">#</th>
              <th className="driver-photo-col"><i className="bi bi-image-fill" /></th>
              <th>Full Name</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Status</th>
              <th>Card fuel</th>
              <th>Carrier</th>
              <th>Lic.<br />Exp. Date</th>
              <th>Actions</th>
            </tr>
            <tr className="legacy-filter-row">
              <th />
              <th />
              <th />
              <th>
                <input className="form-control form-control-sm" placeholder="Find by name" value={filters.name} onChange={(event) => setFilter('name', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by phone" value={filters.phone} onChange={(event) => setFilter('phone', event.target.value)} />
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.type} onChange={(event) => setFilter('type', event.target.value)}>
                  <option value="">Find by type</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                  <option value="">...</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by Card Fuel" value={filters.card} onChange={(event) => setFilter('card', event.target.value)} />
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.carrier} onChange={(event) => setFilter('carrier', event.target.value)}>
                  <option value="">Filter by carrier</option>
                  {carrierOptions.map((carrier) => <option key={carrier} value={carrier}>{carrier}</option>)}
                </select>
              </th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>}
            {!loading && !error && filtered.length === 0 && <tr><td colSpan={11} className="text-center text-muted py-4">No drivers found.</td></tr>}
            {!loading && filtered.map((driver, index) => (
              <DriverRow
                key={driver.id}
                driver={driver}
                index={index}
                selected={selectedSet.has(driver.id)}
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

      {showFieldSettings && (
        <div className="legacy-report-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="driver-report-fields-title">
          <div className="legacy-report-modal">
            <div className="legacy-report-modal-header">
              <h5 id="driver-report-fields-title"><i className="bi bi-gear-fill me-1" />Driver Fields Check For Reports</h5>
              <button className="btn btn-link legacy-report-modal-close" type="button" onClick={() => setShowFieldSettings(false)} aria-label="Close">&times;</button>
            </div>
            <div className="legacy-report-modal-body">
              {settingsError && <div className="alert alert-danger py-2">{settingsError}</div>}
              <table className="table table-sm table-hover mb-0 legacy-grid-table driver-report-fields-table">
                <thead>
                  <tr>
                    <th colSpan={2} className="text-center">Driver Fields</th>
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
                  {!settingsLoading && DRIVER_REPORT_FIELDS.map((field) => (
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
