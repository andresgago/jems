import { useState } from 'react';
import { reportsService } from '../../services/reports';

const currentYear = new Date().getFullYear();

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function BrokerSummaryReportPage() {
  const [year, setYear] = useState(currentYear);
  const [option, setOption] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function run() {
    setLoading(true);
    setError(null);
    setData(null);
    reportsService
      .brokerSummary({ year, option })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <h5 className="mb-0">Broker Summary</h5>
        <select
          className="form-select form-select-sm w-auto"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          className="form-select form-select-sm w-auto"
          value={option}
          onChange={(e) => setOption(Number(e.target.value))}
        >
          <option value={0}>By Broker</option>
          <option value={1}>With Totals</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          {data.brokers.length === 0 ? (
            <p className="text-muted">No broker revenue for {year}.</p>
          ) : (
            <table className="table table-sm table-bordered table-hover">
              <thead className="table-light">
                <tr>
                  <th>Broker</th>
                  <th className="text-end">Revenue {year}</th>
                  {option === 1 && <th className="text-end">Revenue {year - 1}</th>}
                </tr>
              </thead>
              <tbody>
                {data.brokers.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td className="text-end">{fmt(b.revenue)}</td>
                    {option === 1 && <td className="text-end">{fmt(b.prior_revenue)}</td>}
                  </tr>
                ))}
              </tbody>
              {option === 1 && (
                <tfoot className="fw-bold">
                  <tr>
                    <td>Total</td>
                    <td className="text-end">{fmt(data.total_revenue)}</td>
                    <td className="text-end">{fmt(data.total_prior_revenue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </>
      )}
    </div>
  );
}
