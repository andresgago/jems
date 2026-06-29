import { useEffect, useState } from 'react';
import { driversService } from '../../services/drivers';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function LoadCell({ load }) {
  if (!load) return <span className="text-muted">—</span>;
  return (
    <div>
      <div>
        <strong>{load.number}</strong>
        {load.trailer_type && (
          <span className="text-muted ms-1 small">({load.trailer_type})</span>
        )}
        <span className="ms-1 text-muted small">· {formatMoney(load.payment)}</span>
      </div>
      <div className="d-flex align-items-center gap-2 mt-1">
        <div className="small">
          {load.pickup_city ? (
            <>
              <div>{load.pickup_city} ({load.pickup_state})</div>
              <div className="text-muted">{load.pickup_zip}</div>
              <div>{formatDate(load.pickup_date)}</div>
            </>
          ) : '—'}
        </div>
        <i className="bi bi-arrow-right" style={{ fontSize: '1.2rem', flexShrink: 0 }} />
        <div className="small">
          {load.dropoff_city ? (
            <>
              <div>{load.dropoff_city} ({load.dropoff_state})</div>
              <div className="text-muted">{load.dropoff_zip}</div>
              <div>{formatDate(load.dropoff_date)}</div>
            </>
          ) : '—'}
        </div>
      </div>
      {(load.truck || load.trailer) && (
        <div className="text-muted small mt-1">
          {load.truck && <span>{load.truck}</span>}
          {load.truck && load.trailer && <span> — </span>}
          {load.trailer && <span>{load.trailer}</span>}
        </div>
      )}
    </div>
  );
}

export default function DriversLastLoadsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    driversService
      .lastLoads()
      .then((res) => setRows(res.data))
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) =>
    r.full_name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Drivers — Last Loads</h4>

      <div className="mb-3" style={{ maxWidth: 300 }}>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Filter by driver name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {!loading && !error && (
        <div className="table-responsive">
          <table className="table table-bordered table-hover table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>Driver</th>
                <th>Last Load</th>
                <th>Current Load</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-3">
                    No results found.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold align-top">{row.full_name}</td>
                  <td className="align-top">
                    <LoadCell load={row.last_load} />
                  </td>
                  <td className="align-top">
                    <LoadCell load={row.current_load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
