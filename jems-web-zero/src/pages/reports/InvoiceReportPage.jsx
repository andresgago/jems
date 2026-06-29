import { useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { reportsService } from '../../services/reports';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = `${today.getFullYear()}-01-01`;

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function AccountTable({ title, rows }) {
  if (!rows || rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  return (
    <div className="mb-4">
      <h6 className="fw-bold">{title}</h6>
      <table className="table table-sm table-bordered">
        <thead className="table-light">
          <tr>
            <th>Account</th>
            <th className="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.account_code}>
              <td>{r.account_name}</td>
              <td className="text-end">{fmt(r.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="fw-bold">
          <tr>
            <td>Total</td>
            <td className="text-end">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function InvoiceReportPage() {
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
      .invoice({ date_begin: start, date_end: end })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <h5 className="mb-0">Profit and Loss By Invoices</h5>
        <DateRangePicker start={start} end={end} onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }} />
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          {data.invoices && data.invoices.length > 0 && (
            <div className="mb-3">
              <small className="text-muted">
                {data.invoices.length} invoice{data.invoices.length !== 1 ? 's' : ''} included
              </small>
            </div>
          )}
          <AccountTable title="Revenues" rows={data.revenues} />
          <AccountTable title="Expenses" rows={data.expenses} />
          <div className="border-top pt-3">
            <table className="table table-sm table-bordered w-auto">
              <tbody>
                <tr><td className="fw-bold">Total Revenues</td><td className="text-end">{fmt(data.total_revenues)}</td></tr>
                <tr><td className="fw-bold">Total Expenses</td><td className="text-end">{fmt(data.total_expenses)}</td></tr>
                <tr className="table-success fw-bold"><td>Net Profit</td><td className="text-end">{fmt(data.net_profit)}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
