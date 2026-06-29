import { useState } from 'react';
import { reportsService } from '../../services/reports';

const currentYear = new Date().getFullYear();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ShipperReceiverReportPage() {
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
      .shipperReceiver({ year, option })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <h5 className="mb-0">Deliveries from Shipper to Receiver</h5>
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
          <option value={0}>Top 30 Pairs</option>
          <option value={1}>Monthly Breakdown (Top 10)</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && option === 0 && (
        <>
          {data.pairs.length === 0 ? (
            <p className="text-muted">No executed loads with shipper and receiver for {year}.</p>
          ) : (
            <>
              <p className="text-muted small">Total deliveries: <strong>{data.total_deliveries}</strong></p>
              <table className="table table-sm table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Shipper</th>
                    <th>Receiver</th>
                    <th className="text-end">Deliveries</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairs.map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{p.shipper}</td>
                      <td>{p.receiver}</td>
                      <td className="text-end">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {data && option === 1 && (
        <>
          {(!data.pairs || data.pairs.length === 0) ? (
            <p className="text-muted">No data for {year}.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-bordered">
                <thead className="table-light">
                  <tr>
                    <th>Shipper → Receiver</th>
                    {MONTHS.map((m) => <th key={m} className="text-end">{m}</th>)}
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairs.map((p, i) => (
                    <tr key={i}>
                      <td className="text-nowrap">{p.shipper} → {p.receiver}</td>
                      {p.monthly.map((m) => (
                        <td key={m.month} className="text-end">{m.count || '—'}</td>
                      ))}
                      <td className="text-end fw-bold">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
