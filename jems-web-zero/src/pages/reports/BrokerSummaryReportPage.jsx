import { useState } from 'react';

export default function BrokerSummaryReportPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [option, setOption] = useState(0);

  function showReport() {
    if (!Number.isFinite(Number(year))) return;
    const params = new URLSearchParams({
      year: String(year),
      option: String(option),
    });
    window.open(`/print/broker-summary?${params.toString()}`, `BrokerSummary${Math.random()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Broker Summary</h5>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <label htmlFor="broker-summary-year" className="fw-semibold small mb-1 d-block">
            Filter by Year
          </label>
          <input
            id="broker-summary-year"
            className="form-control"
            style={{ height: '48px' }}
            type="number"
            min="1900"
            max="9999"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Filter by Year"
          />
        </div>

        <div className="col-md-4">
          <label htmlFor="broker-summary-option" className="fw-semibold small mb-1 d-block">
            Select Option
          </label>
          <select
            id="broker-summary-option"
            className="form-select"
            style={{ height: '48px' }}
            value={option}
            onChange={(e) => setOption(Number(e.target.value))}
          >
            <option value={0}>Annual Revenues and Deliveries By Brokers</option>
            <option value={1}>Annual Revenues and Deliveries Total</option>
          </select>
        </div>
      </div>

      <button className="btn btn-success" onClick={showReport}>
        Show Report
      </button>
    </div>
  );
}
