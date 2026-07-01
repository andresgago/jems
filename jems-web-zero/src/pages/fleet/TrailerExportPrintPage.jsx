import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trailersService } from '../../services/trailers';
import { usersService } from '../../services/users';
import {
  DEFAULT_TRAILER_REPORT_FIELDS,
  TRAILER_REPORT_FIELDS,
  parseTrailerReportFields,
} from './trailerReportFields';
import { trailerFieldValue, useTrailerReportLookups } from './trailerReportPrintUtils';

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
  };
  return placeholders[field.key] || `Find by ${field.label}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function TrailerExportPrintPage() {
  const [searchParams] = useSearchParams();
  const lookups = useTrailerReportLookups();
  const [trailers, setTrailers] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_TRAILER_REPORT_FIELDS);
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
        if (alive) setSelectedFields(parseTrailerReportFields(response.data.trailer));
      })
      .catch(() => {
        if (alive) setSelectedFields(DEFAULT_TRAILER_REPORT_FIELDS);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!ids.length) {
      setTrailers([]);
      return () => { alive = false; };
    }
    setLoading(true);
    setError('');
    Promise.all(ids.map((id) => trailersService.get(id).then((response) => response.data)))
      .then((items) => {
        if (alive) setTrailers(items);
      })
      .catch(() => {
        if (alive) setError('Error loading trailers export.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  const fields = TRAILER_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));

  const downloadCsv = () => {
    const rows = [
      ['#', ...fields.map((field) => field.label)],
      ...trailers.map((trailer, index) => [
        index + 1,
        ...fields.map((field) => trailerFieldValue(field.key, trailer, lookups)),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trailers-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="driver-export-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Trailers List Report</h1>
      <hr />

      <div className="driver-export-panel">
        <div className="driver-export-panel-heading">
          <span />
          <strong>Showing {trailers.length ? 1 : 0}-{trailers.length} of {trailers.length} items.</strong>
        </div>
        <div className="driver-export-toolbar">
          <button className="btn btn-sm btn-light" type="button" title="All">
            <i className="bi bi-arrows-fullscreen me-1" />All
          </button>
          <button className="btn btn-sm btn-light" type="button" title="Export" onClick={downloadCsv} disabled={!trailers.length}>
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
              {trailers.map((trailer, index) => (
                <tr key={`${trailer.id}-${index}`}>
                  <td>{index + 1}</td>
                  {fields.map((field) => (
                    <td key={field.key}>{trailerFieldValue(field.key, trailer, lookups)}</td>
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
