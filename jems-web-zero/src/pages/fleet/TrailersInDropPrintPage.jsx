import { useEffect, useState } from 'react';
import { trailersService } from '../../services/trailers';

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ' - ';
}

export default function TrailersInDropPrintPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = localDate();
  const year = new Date().getFullYear();

  useEffect(() => {
    let alive = true;
    trailersService.getDropStatuses()
      .then((response) => {
        if (alive) setRows(response.data);
      })
      .catch(() => {
        if (alive) setError('Error loading trailers in drop.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="driver-list-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Trailers in Drop Report</h1>

      {loading && <div className="text-center text-muted">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="text-center text-muted">No trailers currently in drop.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <table className="driver-export-table">
          <thead>
            <tr>
              <th>Trailer</th>
              <th>Drop Status</th>
              <th>Load Status</th>
              <th>Load Number</th>
              <th>Pickup Date</th>
              <th>Dropoff Date</th>
              <th>Drop Place</th>
              <th>Dispatcher</th>
              <th>Driver</th>
              <th>Truck</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.trailer_id}>
                <td>{row.trailer_number} - {row.trailer_vin}</td>
                <td>{row.drop_label}</td>
                <td>{row.load_status || ' - '}</td>
                <td>{row.load_number || ' - '}</td>
                <td>{dateOnly(row.pickup_date)}</td>
                <td>{dateOnly(row.dropoff_date)}</td>
                <td>{row.drop_place || ' - '}</td>
                <td>{row.dispatcher || ' - '}</td>
                <td>{row.driver || ' - '}</td>
                <td>{row.truck_number ? `${row.truck_number} - ${row.truck_vin || ''}` : ' - '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="driver-list-report-footer">Copyright &copy; 2019 - {year}</footer>
    </div>
  );
}
