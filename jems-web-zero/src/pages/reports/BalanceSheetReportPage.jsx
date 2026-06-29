import { useEffect, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import api from '../../services/api';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEnd(date) {
  return formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function weekStart(date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day + (day === 0 ? -6 : 1));
  return formatDate(next);
}

function weekEnd(date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day + (day === 0 ? 0 : 7));
  return formatDate(next);
}

const PERIOD_OPTIONS = [
  { value: '1', label: 'Month' },
  { value: '2', label: 'Week' },
];

export default function BalanceSheetReportPage() {
  const [carrier, setCarrier] = useState('');
  const [period, setPeriod] = useState('1');
  const [start, setStart] = useState(monthStart(new Date()));
  const [end, setEnd] = useState(monthEnd(new Date()));
  const [carrierOptions, setCarrierOptions] = useState([]);

  useEffect(() => {
    api.get('/carriers/options/')
      .then((r) => setCarrierOptions(r.data))
      .catch(() => setCarrierOptions([]));
  }, []);

  function handlePeriodChange(value) {
    setPeriod(value);
    const now = new Date();
    if (value === '1') {
      setStart(monthStart(now));
      setEnd(monthEnd(now));
    } else if (value === '2') {
      setStart(weekStart(now));
      setEnd(weekEnd(now));
    }
  }

  function handleShowReport() {
    const params = new URLSearchParams();
    params.set('date_begin', start);
    params.set('date_end', end);
    params.set('period', period);
    if (carrier) params.set('carrier', carrier);
    window.open(`/print/balance-sheet?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Balance Sheet</h5>

      <div className="row g-3 mb-4">
        <div className="col-md-5">
          <label htmlFor="filter-carrier" className="fw-semibold small mb-1 d-block">Carrier</label>
          <select
            id="filter-carrier"
            className="form-select"
            style={{ height: '48px' }}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            <option value="">All carriers</option>
            {carrierOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label || c.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label htmlFor="filter-period" className="fw-semibold small mb-1 d-block">Period</label>
          <select
            id="filter-period"
            className="form-select"
            style={{ height: '48px' }}
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-5">
          <label className="fw-semibold small mb-1 d-block">Select date range</label>
          <DateRangePicker
            start={start}
            end={end}
            onApply={({ start: s, end: e }) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </div>
      </div>

      <button className="btn btn-success" onClick={handleShowReport}>
        Show Report
      </button>
    </div>
  );
}
