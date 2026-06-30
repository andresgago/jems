import { useState } from 'react';

const currentYear = new Date().getFullYear();

export default function ShipperReceiverReportPage() {
  const [year, setYear] = useState(currentYear);
  const [option, setOption] = useState(0);

  function showReport() {
    if (!Number.isFinite(Number(year))) return;
    const params = new URLSearchParams({
      year: String(year),
      option: String(option),
    });
    window.open(`/print/shipper-receiver?${params.toString()}`, `ShipperReceiver${Math.random()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Deliveries from Shipper to Receiver</h5>

      <div className="row g-4 mb-4 align-items-start">
        <div className="col-md-3">
          <label htmlFor="shipper-receiver-year" className="fw-semibold small mb-1 d-block">
            Filter by Year
          </label>
          <div className="input-group">
            <button
              type="button"
              className="btn text-white"
              style={{ background: '#5bc0aa', height: '48px', width: '52px' }}
              title="Year picker"
              aria-label="Year picker"
            >
              <i className="bi bi-calendar3" />
            </button>
            <button
              type="button"
              className="btn text-white"
              style={{ background: '#5bc0aa', height: '48px', width: '52px' }}
              title="Clear year"
              aria-label="Clear year"
              onClick={() => setYear('')}
            >
              <i className="bi bi-x-lg" />
            </button>
            <input
              id="shipper-receiver-year"
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
        </div>

        <div className="col-md-5">
          <label htmlFor="shipper-receiver-option" className="fw-semibold small mb-1 d-block">
            Select Option
          </label>
          <select
            id="shipper-receiver-option"
            className="form-select"
            style={{ height: '48px' }}
            value={option}
            onChange={(e) => setOption(Number(e.target.value))}
          >
            <option value={0}>Deliveries from Shipper to Receiver (Annual Top 30)</option>
            <option value={1}>Deliveries from Shipper to Receiver (By Months Top 10)</option>
          </select>
        </div>
      </div>

      <button className="btn btn-success" onClick={showReport}>
        Show Report
      </button>
    </div>
  );
}
