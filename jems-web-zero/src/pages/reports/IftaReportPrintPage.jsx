import { Fragment, useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmt(gallons) {
  return Number(gallons || 0).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function IftaReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { dateBegin, dateEnd } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      dateBegin: params.get('date_begin') || '',
      dateEnd: params.get('date_end') || '',
    };
  }, []);

  useEffect(() => {
    if (!dateBegin || !dateEnd) {
      setError('Missing date range.');
      setLoading(false);
      return;
    }
    reportsService
      .ifta({ date_begin: dateBegin, date_end: dateEnd })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load IFTA report.'))
      .finally(() => setLoading(false));
  }, [dateBegin, dateEnd]);

  if (loading) return <div className="text-center p-5">Loading…</div>;
  if (error) return <div className="alert alert-danger m-3">{error}</div>;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container-fluid py-3">
      <div className="row mb-2">
        <div className="col text-end">
          <small>Date: {today}</small>
        </div>
      </div>

      <div className="row mb-2">
        <div className="col text-center">
          <h2 style={{ color: '#333' }}>IFTA</h2>
        </div>
      </div>

      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered mb-0">
          <thead>
            <tr className="table-light text-center">
              <th colSpan={3} className="fw-bold">State / Fuel Card</th>
            </tr>
            <tr>
              <td colSpan={3} className="text-end fw-bold">
                <strong>Date Range:</strong> {dateBegin} ➤ {dateEnd}
              </td>
            </tr>
          </thead>
        </table>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-bordered table-hover table-striped">
          <thead>
            <tr>
              <th width="10%" className="text-center">No.</th>
              <th width="70%" className="text-center">State</th>
              <th width="20%" className="text-center">Gallons</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, idx) => (
              <Fragment key={row.state_abbreviation}>
                <tr>
                  <td className="text-center">{idx + 1}</td>
                  <td>{row.state_name} ({row.state_abbreviation})</td>
                  <td className="text-end">{fmt(row.gallons)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    <span className="text-secondary fw-semibold small">Cards</span>
                  </td>
                </tr>
                {row.cards.map((card) => (
                  <tr key={`${row.state_abbreviation}-${card.card_number}`}>
                    <td colSpan={2} className="ps-4">{card.card_number}</td>
                    <td className="text-end">{fmt(card.gallons)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="table-light fw-bold">
              <td colSpan={2}>TOTAL OF GALLONS</td>
              <td className="text-end">{fmt(data.total_gallons)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
