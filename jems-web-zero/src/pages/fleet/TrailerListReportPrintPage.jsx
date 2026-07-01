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

function useTrailerReportData() {
  const [searchParams] = useSearchParams();
  const [trailers, setTrailers] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_TRAILER_REPORT_FIELDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const idsKey = useMemo(() => searchParams.get('ids') || searchParams.get('keylist') || '', [searchParams]);
  const ids = useMemo(() => idsKey.split(',').map((value) => value.trim()).filter(Boolean), [idsKey]);

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
        if (alive) setError('Error loading trailers report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  return { ids, trailers, selectedFields, loading, error };
}

export default function TrailerListReportPrintPage() {
  const { ids, trailers, selectedFields, loading, error } = useTrailerReportData();
  const lookups = useTrailerReportLookups();
  const today = localDate();
  const year = new Date().getFullYear();
  const fields = TRAILER_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));

  return (
    <div className="driver-list-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Trailers List Report</h1>

      {loading && <div className="text-center text-muted">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && ids.length === 0 && (
        <div className="text-center text-muted">No trailers selected.</div>
      )}

      {!loading && !error && trailers.map((trailer, index) => (
        <section className="driver-report-section" key={`${trailer.id}-${index}`}>
          <div className="driver-report-heading">
            <span># {index + 1}</span>
            <strong>{trailer.number} - {trailer.vin}</strong>
            <span />
          </div>

          <table className="driver-report-detail-table">
            <tbody>
              {fields.map((field) => (
                <tr key={field.key}>
                  <th>{field.label}</th>
                  <td>{trailerFieldValue(field.key, trailer, lookups)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="driver-list-report-footer">Copyright &copy; 2019 - {year}</footer>
    </div>
  );
}
