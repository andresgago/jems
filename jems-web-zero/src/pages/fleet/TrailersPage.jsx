import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrailers } from '../../hooks/useTrailers';
import { trailersService, TRAILER_STATUS } from '../../services/trailers';
import { usersService } from '../../services/users';
import { mediaUrl } from '../../utils/media';
import {
  TRAILER_REPORT_FIELDS,
  parseTrailerReportFields,
  serializeTrailerReportFields,
} from './trailerReportFields';
import { TRAILER_REPORT_WINDOW_FEATURES } from './trailerReportPrintUtils';

function StatusText({ status }) {
  const s = TRAILER_STATUS[status] || { label: status };
  return <span>{s.label}</span>;
}

function ExpDate({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  const expired = new Date(value) < new Date(new Date().toDateString());
  return <div className={expired ? 'text-danger fw-semibold' : ''}>{value}</div>;
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

function DropCell({ trailer }) {
  const isActive = trailer.status === 1 && !trailer.is_rented;
  if (!isActive) return <span className="text-muted small">{trailer.drop_label || '—'}</span>;
  const icon = trailer.drop_status?.is_drop ? 'bi-geo-alt-fill text-warning' : 'bi-signpost-split-fill text-primary';
  return (
    <div className="small">
      <i className={`bi ${icon} me-1`} />
      {trailer.drop_label || '—'}
    </div>
  );
}

function TrailerRow({ trailer, index, selected, onSelect, onChanged }) {
  const [actioning, setActioning] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const isActive = trailer.status === 1;

  const toggle = async () => {
    const message = isActive
      ? 'Are you sure to deactivate this item?'
      : 'Are you sure to activate this item?';
    if (!window.confirm(message)) return;
    setActioning(true);
    try {
      await trailersService.toggleStatus(trailer.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Are you sure to delete this item?')) return;
    await trailersService.destroy(trailer.id);
    onChanged();
  };

  const generateAvi = async () => {
    setPdfBusy(true);
    try {
      const response = await trailersService.getAviPdf(trailer.id);
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <tr className={!isActive ? 'row-desactivada' : ''}>
      <td className="text-center">
        <input
          type="checkbox"
          aria-label={`Select trailer ${trailer.number}`}
          checked={selected}
          onChange={(event) => onSelect(trailer.id, event.target.checked)}
        />
      </td>
      <td className="text-center">{index + 1}</td>
      <td className="text-center">
        <Link to={`/fleet/trailers/${trailer.id}`} className="fw-semibold text-decoration-none">
          {trailer.number}
        </Link>
      </td>
      <td className="text-center">{trailer.vin || <span className="text-muted">—</span>}</td>
      <td className="text-center document-col"><DocumentCell file={trailer.annual_inspection_file} label="Annual Inspection" /></td>
      <td className="text-center"><ExpDate value={trailer.annual_inspection_expiration} /></td>
      <td className="text-center document-col"><DocumentCell file={trailer.registration_file} label="Registration" /></td>
      <td className="text-center">{trailer.year || <span className="text-muted">—</span>}</td>
      <td className="text-center">{trailer.width ?? <span className="text-muted">—</span>}</td>
      <td className="text-center">{trailer.height ?? <span className="text-muted">—</span>}</td>
      <td className="text-center">{trailer.plate_number || <span className="text-muted">—</span>}</td>
      <td className="text-center">{trailer.plate_state_name || <span className="text-muted">—</span>}</td>
      <td className="text-center"><StatusText status={trailer.status} /></td>
      <td className="text-center">{trailer.trailer_type_name || <span className="text-muted">—</span>}</td>
      <td className="text-center">
        <Link className="btn btn-link btn-sm p-0 me-2" to={`/fleet/trailers/${trailer.id}`} title="View">
          <i className="bi bi-eye-fill" />
        </Link>
        <Link className="btn btn-link btn-sm p-0 me-2" to={`/fleet/trailers/${trailer.id}/edit`} title="Update">
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
        <button className="btn btn-link btn-sm p-0" type="button" title="View Trailer" onClick={() => window.open(`/print/trailers?ids=${trailer.id}`, '_blank', TRAILER_REPORT_WINDOW_FEATURES)}>
          <i className="bi bi-printer-fill" />
        </button>
      </td>
      <td className="text-center"><DropCell trailer={trailer} /></td>
      <td className="text-center avi-action-col">
        {isActive ? (
          <button className="btn btn-xs btn-outline-success legacy-new-avi-btn" type="button" disabled={pdfBusy} onClick={generateAvi}>
            {pdfBusy ? '...' : 'New AVI'}
          </button>
        ) : (
          <span className="text-muted small">Inactive</span>
        )}
      </td>
    </tr>
  );
}

const PAGE_SIZE = 50;

const EMPTY_FILTERS = {
  number: '',
  vin: '',
  year: '',
  width: '',
  height: '',
  plate: '',
  state: '',
  status: '',
  type: '',
};

export default function TrailersPage() {
  const { trailers, loading, error, refresh } = useTrailers();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState([]);
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [fieldSettings, setFieldSettings] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [page, setPage] = useState(1);

  const stateOptions = useMemo(() => {
    const values = new Map();
    trailers.forEach((trailer) => {
      if (trailer.plate_state_name) values.set(trailer.plate_state_name, trailer.plate_state_name);
    });
    return Array.from(values.values()).sort();
  }, [trailers]);

  const typeOptions = useMemo(() => {
    const values = new Map();
    trailers.forEach((trailer) => {
      if (trailer.trailer_type_name) values.set(trailer.trailer_type_name, trailer.trailer_type_name);
    });
    return Array.from(values.values()).sort();
  }, [trailers]);

  const filtered = useMemo(() => {
    const number = filters.number.trim().toLowerCase();
    const vin = filters.vin.trim().toLowerCase();
    const year = filters.year.trim();
    const width = filters.width.trim();
    const height = filters.height.trim();
    const plate = filters.plate.trim().toLowerCase();
    return trailers.filter((trailer) => {
      if (number && !trailer.number.toLowerCase().includes(number)) return false;
      if (vin && !(trailer.vin || '').toLowerCase().includes(vin)) return false;
      if (year && String(trailer.year || '') !== year) return false;
      if (width && String(trailer.width ?? '') !== width) return false;
      if (height && String(trailer.height ?? '') !== height) return false;
      if (plate && !(trailer.plate_number || '').toLowerCase().includes(plate)) return false;
      if (filters.state && trailer.plate_state_name !== filters.state) return false;
      if (filters.status !== '' && String(trailer.status) !== filters.status) return false;
      if (filters.type && trailer.trailer_type_name !== filters.type) return false;
      return true;
    });
  }, [trailers, filters]);

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
    const pageIds = pageRows.map((trailer) => trailer.id);
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
    await Promise.all(selected.map((id) => trailersService.destroy(id)));
    setSelected([]);
    refresh();
  };

  const openTrailersReport = () => {
    if (!selected.length) {
      window.alert('Please select some trailers to show');
      return;
    }
    window.open(`/print/trailers?ids=${encodeURIComponent(selected.join(','))}`, '_blank', TRAILER_REPORT_WINDOW_FEATURES);
  };

  const openTrailersExport = () => {
    if (!selected.length) {
      window.alert('Please select some trailers to show');
      return;
    }
    window.open(`/print/trailers/export?ids=${encodeURIComponent(selected.join(','))}`, '_blank', TRAILER_REPORT_WINDOW_FEATURES);
  };

  // "Trailers in Drop" is unconditional (no selection required), unlike
  // Report/Export — matches legacy's openReportDropList() behavior.
  const openTrailersInDrop = () => {
    window.open('/print/trailers/in-drop', '_blank', TRAILER_REPORT_WINDOW_FEATURES);
  };

  const openFieldSettings = async () => {
    setShowFieldSettings(true);
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const response = await usersService.getDisplayOptions();
      setFieldSettings(parseTrailerReportFields(response.data.trailer));
    } catch {
      setSettingsError('Error loading trailer report fields.');
      setFieldSettings(parseTrailerReportFields(''));
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
      await usersService.updateDisplayOptions({ trailer: serializeTrailerReportFields(fieldSettings) });
      setShowFieldSettings(false);
    } catch {
      setSettingsError('Error saving trailer report fields.');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="legacy-grid-page">
      <div className="legacy-grid-title">
        <h5><i className="bi bi-list me-1" />Trailers</h5>
        <span>Showing {filtered.length ? pageStart + 1 : 0}-{pageEnd} of {filtered.length} items.</span>
      </div>

      <div className="legacy-grid-toolbar">
        <Link to="/fleet/trailers/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />New Trailer
        </Link>
        <button className="btn btn-sm btn-success" type="button" onClick={openTrailersReport} title="Trailers Report">
          <i className="bi bi-printer-fill me-1" />Trailers Report
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={openTrailersExport} title="Trailers Export">
          <i className="bi bi-file-earmark-spreadsheet-fill" />
        </button>
        <button className="btn btn-sm btn-info text-white" type="button" onClick={openFieldSettings} title="Setting Fields For Reports">
          <i className="bi bi-gear-fill" />
        </button>
        <button className="btn btn-sm btn-primary" type="button" onClick={openTrailersInDrop} title="Trailers in Drop">
          <i className="bi bi-geo-alt-fill me-1" />Trailers in Drop
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={refresh} title="Reset Grid">
          <i className="bi bi-arrow-clockwise" />
        </button>
        <button className="btn btn-sm btn-success" type="button" onClick={() => { setFilters(EMPTY_FILTERS); setSelected([]); }}>
          <i className="bi bi-check2-all me-1" />All
        </button>
      </div>

      {error && <div className="alert alert-danger mb-0">Error loading trailers.</div>}

      <div className="legacy-grid-wrap">
        <table className="table table-sm table-hover mb-0 legacy-grid-table trailers-grid-table">
          <thead>
            <tr>
              <th className="select-col">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={pageRows.length > 0 && pageRows.every((trailer) => selectedSet.has(trailer.id))}
                  onChange={(event) => selectAll(event.target.checked)}
                />
              </th>
              <th className="serial-col">#</th>
              <th>Number</th>
              <th>Vin Number</th>
              <th>AI</th>
              <th>AIED</th>
              <th>Registration</th>
              <th>Year</th>
              <th>Width</th>
              <th>Height</th>
              <th>Plate</th>
              <th>State</th>
              <th>Status</th>
              <th>Type</th>
              <th>Actions</th>
              <th><i className="bi bi-printer-fill" /></th>
              <th>Drop</th>
              <th>AVI</th>
            </tr>
            <tr className="legacy-filter-row">
              <th />
              <th />
              <th>
                <input className="form-control form-control-sm" placeholder="Find by number" value={filters.number} onChange={(event) => setFilter('number', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by Vin number" value={filters.vin} onChange={(event) => setFilter('vin', event.target.value)} />
              </th>
              <th />
              <th />
              <th />
              <th>
                <input className="form-control form-control-sm" placeholder="Find by year" value={filters.year} onChange={(event) => setFilter('year', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by width" value={filters.width} onChange={(event) => setFilter('width', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by height" value={filters.height} onChange={(event) => setFilter('height', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by plate" value={filters.plate} onChange={(event) => setFilter('plate', event.target.value)} />
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.state} onChange={(event) => setFilter('state', event.target.value)}>
                  <option value="">...</option>
                  {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
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
                <select className="form-select form-select-sm" value={filters.type} onChange={(event) => setFilter('type', event.target.value)}>
                  <option value="">...</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </th>
              <th />
              <th />
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={18} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>}
            {!loading && !error && filtered.length === 0 && <tr><td colSpan={18} className="text-center text-muted py-4">No trailers found.</td></tr>}
            {!loading && pageRows.map((trailer, index) => (
              <TrailerRow
                key={trailer.id}
                trailer={trailer}
                index={pageStart + index}
                selected={selectedSet.has(trailer.id)}
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
        <div className="legacy-report-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trailer-report-fields-title">
          <div className="legacy-report-modal">
            <div className="legacy-report-modal-header">
              <h5 id="trailer-report-fields-title"><i className="bi bi-gear-fill me-1" />Trailer Fields Check For Reports</h5>
              <button className="btn btn-link legacy-report-modal-close" type="button" onClick={() => setShowFieldSettings(false)} aria-label="Close">&times;</button>
            </div>
            <div className="legacy-report-modal-body">
              {settingsError && <div className="alert alert-danger py-2">{settingsError}</div>}
              <table className="table table-sm table-hover mb-0 legacy-grid-table driver-report-fields-table">
                <thead>
                  <tr>
                    <th colSpan={2} className="text-center">Trailer Fields</th>
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
                  {!settingsLoading && TRAILER_REPORT_FIELDS.map((field) => (
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
