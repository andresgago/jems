import { useEffect, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import api from '../../services/api';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);

export default function TaxReportPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [option, setOption] = useState(0);
  const [carrier, setCarrier] = useState('');
  const [carrierOptions, setCarrierOptions] = useState([]);

  useEffect(() => {
    api.get('/carriers/options/').then((r) => setCarrierOptions(r.data)).catch(() => {});
  }, []);

  function showReport() {
    const params = new URLSearchParams({
      date_begin: start,
      date_end: end,
      option: String(option),
    });
    if (carrier) params.set('carrier', carrier);
    window.open(`/print/tax?${params.toString()}`, `TaxReport${Math.random()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-4">Tax Report</h5>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="fw-semibold small mb-1 d-block">Select date range</label>
          <DateRangePicker
            start={start}
            end={end}
            onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }}
          />
        </div>

        <div className="col-md-3">
          <label htmlFor="tax-option" className="fw-semibold small mb-1 d-block">
            Select Option
          </label>
          <select
            id="tax-option"
            className="form-select"
            style={{ height: '48px' }}
            value={option}
            onChange={(e) => setOption(Number(e.target.value))}
          >
            <option value={0}>Only Tax</option>
            <option value={1}>Tax and Revenues</option>
          </select>
        </div>

        <div className="col-md-3">
          <label htmlFor="tax-carrier" className="fw-semibold small mb-1 d-block">
            Carrier
          </label>
          <select
            id="tax-carrier"
            className="form-select"
            style={{ height: '48px' }}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            <option value="">Select a carrier</option>
            {carrierOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn btn-success" onClick={showReport}>
        Show Report
      </button>
    </div>
  );
}
