import { useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';

function defaultDates() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const start = sevenDaysAgo.toISOString().slice(0, 10);
  return { start, end };
}

const { start: DEFAULT_START, end: DEFAULT_END } = defaultDates();

export default function IftaReportPage() {
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);

  function handleShowReport() {
    const params = new URLSearchParams();
    params.set('date_begin', start);
    params.set('date_end', end);
    window.open(`/print/ifta?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">IFTA</h5>

      <div className="row g-3 mb-3">
        <div className="col-md-5">
          <label className="fw-semibold small mb-1 d-block">Filter by Dates</label>
          <DateRangePicker
            start={start}
            end={end}
            onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }}
          />
        </div>
      </div>

      <button className="btn btn-success" onClick={handleShowReport}>
        Show Report
      </button>
    </div>
  );
}
