import { useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { reportsService } from '../../services/reports';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = `${today.getFullYear()}-01-01`;

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function TaxTable({ title, section, showRevenue }) {
  if (!section || section.rows.length === 0) return null;
  return (
    <div className="mb-4">
      <h6 className="fw-bold">{title}</h6>
      <table className="table table-sm table-bordered table-hover">
        <thead className="table-light">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Address</th>
            <th>SSN</th>
            {showRevenue && <th className="text-end">Revenue</th>}
            <th className="text-end">Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.email || '—'}</td>
              <td>{r.address || '—'}</td>
              <td>{r.ssn || '—'}</td>
              {showRevenue && <td className="text-end">{fmt(r.revenue)}</td>}
              <td className="text-end">{fmt(r.tax)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="fw-bold">
          <tr>
            <td colSpan={showRevenue ? 5 : 4}>Total</td>
            <td className="text-end">{fmt(section.total_tax)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function TaxReportPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [option, setOption] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function run() {
    setLoading(true);
    setError(null);
    setData(null);
    reportsService
      .tax({ date_begin: start, date_end: end, option })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <h5 className="mb-0">Tax Report</h5>
        <DateRangePicker start={start} end={end} onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }} />
        <select
          className="form-select form-select-sm w-auto"
          value={option}
          onChange={(e) => setOption(Number(e.target.value))}
        >
          <option value={0}>Standard</option>
          <option value={1}>With Revenue</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          <TaxTable title="Drivers (Solo & Team)" section={data.drivers} showRevenue={option === 1} />
          <TaxTable title="Owner Operators" section={data.owners} showRevenue={option === 1} />
          <TaxTable title="Dispatchers" section={data.dispatchers} showRevenue={option === 1} />
        </>
      )}
    </div>
  );
}
