import { useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { reportsService } from '../../services/reports';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = `${today.getFullYear()}-01-01`;

export default function IftaReportPage() {
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
      .ifta({ date_begin: start, date_end: end })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <h5 className="mb-0">IFTA Report</h5>
        <DateRangePicker start={start} end={end} onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }} />
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && data.rows.length === 0 && (
        <p className="text-muted">No IFTA records for this period.</p>
      )}

      {data && data.rows.map((row) => (
        <div key={row.state_abbreviation} className="mb-4">
          <h6 className="fw-bold">{row.state_name} ({row.state_abbreviation})</h6>
          <table className="table table-sm table-bordered">
            <thead className="table-light">
              <tr>
                <th>Card</th>
                <th className="text-end">Gallons</th>
              </tr>
            </thead>
            <tbody>
              {row.cards.map((card) => (
                <tr key={card.card_number}>
                  <td>{card.card_number}</td>
                  <td className="text-end">{card.gallons.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="fw-bold">
              <tr>
                <td>State Total</td>
                <td className="text-end">{row.gallons.toFixed(3)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {data && data.rows.length > 0 && (
        <div className="border-top pt-3">
          <strong>Grand Total: {data.total_gallons.toFixed(3)} gallons</strong>
        </div>
      )}
    </div>
  );
}
