import { useState } from 'react';
import api from '../../services/api';

const BUY_STATUS_ROW_CLASS = {
  'Approved For Purchases': 'table-success',
  'No Buy - Denied For Purchases': 'table-danger',
  'Credit Approval Required': 'table-warning',
};

function buyStatusClass(debtor_buy_status) {
  return BUY_STATUS_ROW_CLASS[debtor_buy_status] || '';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function LastLoadCell({ load }) {
  if (!load) return <span className="text-muted">—</span>;
  return (
    <span className="small">
      <strong>#{load.number}</strong>
      <br />
      {load.pickup_city} → {load.dropoff_city}
      <br />
      {formatMoney(load.payment)} · {formatDate(load.pickup_date)}
    </span>
  );
}

export default function BrokersStatusPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.get('/brokers/status-search/', { params: { q } });
      setResults(res.data);
    } catch {
      setError('Search failed. Please try again.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-4">Brokers Status</h4>

      <form className="row g-2 mb-3" onSubmit={handleSearch}>
        <div className="col-auto">
          <input
            type="text"
            className="form-control"
            placeholder="Search by name or MC…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="col-auto">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {results !== null && results.length === 0 && (
        <p className="text-muted">No brokers found for <em>{query}</em>.</p>
      )}

      {results !== null && results.length > 0 && (
        <div className="table-responsive">
          <table className="table table-bordered table-hover table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>MC</th>
                <th>Name</th>
                <th>TAFS debtor buy status</th>
                <th>SAFER status</th>
                <th>Checked</th>
                <th>Last load</th>
              </tr>
            </thead>
            <tbody>
              {results.map((broker, idx) => (
                <tr key={broker.id} className={buyStatusClass(broker.debtor_buy_status)}>
                  <td className="text-center">{idx + 1}</td>
                  <td>{broker.mc}</td>
                  <td>
                    <strong>{broker.name}</strong>
                    {broker.dba_name && (
                      <span className="text-muted ms-1 small">({broker.dba_name})</span>
                    )}
                  </td>
                  <td>{broker.debtor_buy_status || '—'}</td>
                  <td>{broker.safer_operating_status || '—'}</td>
                  <td>{formatDate(broker.checked_at)}</td>
                  <td>
                    <LastLoadCell load={broker.last_load} />
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
