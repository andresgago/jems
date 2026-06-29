import { useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { reportsService } from '../../services/reports';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = `${today.getFullYear()}-01-01`;

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function CategoryTrackingReportPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function run() {
    setLoading(true);
    setError(null);
    setData(null);
    reportsService
      .categoryTracking({ date_begin: start, date_end: end })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <h5 className="mb-0">Category Tracking</h5>
        <DateRangePicker start={start} end={end} onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }} />
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          {data.rows.length === 0 ? (
            <p className="text-muted">No category tracking records for this period.</p>
          ) : (
            <table className="table table-sm table-bordered table-hover">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Entity</th>
                  <th className="text-end">Amount</th>
                  <th className="text-end">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-nowrap">{r.date}</td>
                    <td>{r.description || '—'}</td>
                    <td>{r.account}</td>
                    <td>{r.entity || '—'}</td>
                    <td className="text-end">{fmt(r.amount)}</td>
                    <td className="text-end">{r.quantity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="fw-bold">
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="text-end">{fmt(data.total_amount)}</td>
                  <td className="text-end">{data.total_quantity}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </>
      )}
    </div>
  );
}
