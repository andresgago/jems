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

function useTruckReportData() {
  const [searchParams] = useSearchParams();
  const [trucks, setTrucks] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_TRUCK_REPORT_FIELDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const idsKey = useMemo(() => searchParams.get('ids') || searchParams.get('keylist') || '', [searchParams]);
  const ids = useMemo(() => idsKey.split(',').map((value) => value.trim()).filter(Boolean), [idsKey]);

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
        if (alive) setError('Error loading trucks report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  return { ids, trucks, selectedFields, loading, error };
}

export default function TruckListReportPrintPage() {
  const { ids, trucks, selectedFields, loading, error } = useTruckReportData();
  const lookups = useTruckReportLookups();
  const today = localDate();
  const year = new Date().getFullYear();
  const fields = TRUCK_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));

  return (
    <div className="driver-list-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Trucks List Report</h1>

      {loading && <div className="text-center text-muted">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && ids.length === 0 && (
        <div className="text-center text-muted">No trucks selected.</div>
      )}

      {!loading && !error && trucks.map((truck, index) => (
        <section className="driver-report-section" key={`${truck.id}-${index}`}>
          <div className="driver-report-heading">
            <span># {index + 1}</span>
            <strong>Truck #{truck.number}{truck.truck_type_name ? ` (${truck.truck_type_name})` : ''}</strong>
            <span />
          </div>

          <table className="driver-report-detail-table">
            <tbody>
              {fields.map((field) => (
                <tr key={field.key}>
                  <th>{field.label}</th>
                  <td>{truckFieldValue(field.key, truck, lookups)}</td>
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
