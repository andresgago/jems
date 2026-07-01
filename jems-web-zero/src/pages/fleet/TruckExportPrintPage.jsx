import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trucksService } from '../../services/trucks';
import { usersService } from '../../services/users';
import {
  DEFAULT_TRUCK_REPORT_FIELDS,
  TRUCK_REPORT_FIELDS,
  parseTruckReportFields,
} from './truckReportFields';
import { truckFieldValue, useTruckReportLookups } from './truckReportPrintUtils';

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function filterPlaceholder(field) {
  const placeholders = {
    number: 'Find by number',
    VIN: 'Find by Vin number',
    plate: 'Find by plate',
    transponder: 'Find by transponder',
  };
  return placeholders[field.key] || `Find by ${field.label}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function TruckExportPrintPage() {
  const [searchParams] = useSearchParams();
  const lookups = useTruckReportLookups();
  const [trucks, setTrucks] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_TRUCK_REPORT_FIELDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const idsKey = useMemo(() => searchParams.get('ids') || searchParams.get('keylist') || '', [searchParams]);
  const ids = useMemo(() => idsKey.split(',').map((value) => value.trim()).filter(Boolean), [idsKey]);
  const today = localDate();
  const year = new Date().getFullYear();

  useEffect(() => {
    let alive = true;
    usersService.getDisplayOptions()
      .then((response) => {
        if (alive) setSelectedFields(parseTruckReportFields(response.data.truck));
      })
      .catch(() => {
        if (alive) setSelectedFields(DEFAULT_TRUCK_REPORT_FIELDS);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!ids.length) {
      setTrucks([]);
      return () => { alive = false; };
    }
    setLoading(true);
    setError('');
    Promise.all(ids.map((id) => trucksService.get(id).then((response) => response.data)))
      .then((items) => {
        if (alive) setTrucks(items);
      })
      .catch(() => {
        if (alive) setError('Error loading trucks export.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  const fields = TRUCK_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));

  const downloadCsv = () => {
    const rows = [
      ['#', ...fields.map((field) => field.label)],
      ...trucks.map((truck, index) => [
        index + 1,
        ...fields.map((field) => truckFieldValue(field.key, truck, lookups, { exportMode: true })),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trucks-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="driver-export-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Trucks List Report</h1>
      <hr />

      <div className="driver-export-panel">
        <div className="driver-export-panel-heading">
          <span />
          <strong>Showing {trucks.length ? 1 : 0}-{trucks.length} of {trucks.length} items.</strong>
        </div>
        <div className="driver-export-toolbar">
          <button className="btn btn-sm btn-light" type="button" title="All">
            <i className="bi bi-arrows-fullscreen me-1" />All
          </button>
          <button className="btn btn-sm btn-light" type="button" title="Export" onClick={downloadCsv} disabled={!trucks.length}>
            <i className="bi bi-file-earmark-spreadsheet-fill" />
            <i className="bi bi-caret-down-fill ms-1" />
          </button>
        </div>

        {loading && <div className="text-center text-muted py-3">Loading...</div>}
        {error && <div className="alert alert-danger m-2">{error}</div>}
        {!loading && !error && (
          <table className="driver-export-table">
            <thead>
              <tr>
                <th className="driver-export-number-col">#</th>
                {fields.map((field, index) => (
                  <th key={field.key}>
                    {field.label}
                    {index === 0 && <i className="bi bi-sort-down ms-1 text-primary" />}
                  </th>
                ))}
              </tr>
              <tr className="driver-export-filter-row">
                <th />
                {fields.map((field) => (
                  <th key={field.key}>
                    <input className="form-control form-control-sm" placeholder={filterPlaceholder(field)} readOnly />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trucks.map((truck, index) => (
                <tr key={`${truck.id}-${index}`}>
                  <td>{index + 1}</td>
                  {fields.map((field) => (
                    <td key={field.key}>{truckFieldValue(field.key, truck, lookups, { exportMode: true })}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="driver-export-report-footer">
        <div>Jobee Express LLC</div>
        <div>Copyright &copy; 2019 - {year}</div>
      </footer>
    </div>
  );
}
