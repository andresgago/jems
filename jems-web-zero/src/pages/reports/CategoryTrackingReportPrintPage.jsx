import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmt(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtQty(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CategoryTrackingReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { dateBegin, dateEnd, trucks, trailers, categories, positions,
    truckLabels, trailerLabels, categoryLabels, positionLabels } = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      dateBegin: p.get('date_begin') || '',
      dateEnd: p.get('date_end') || '',
      trucks: p.getAll('truck'),
      trailers: p.getAll('trailer'),
      categories: p.getAll('category'),
      positions: p.getAll('position'),
      truckLabels: p.getAll('truck_label'),
      trailerLabels: p.getAll('trailer_label'),
      categoryLabels: p.getAll('category_label'),
      positionLabels: p.getAll('position_label'),
    };
  }, []);

  useEffect(() => {
    const params = { date_begin: dateBegin, date_end: dateEnd };
    if (trucks.length) params.truck = trucks;
    if (trailers.length) params.trailer = trailers;
    if (categories.length) params.category = categories;
    if (positions.length) params.position = positions;
    reportsService
      .categoryTracking(params)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [dateBegin, dateEnd, trucks, trailers, categories, positions]);

  const today = new Date().toISOString().slice(0, 10);

  const truckSummary = truckLabels.length ? truckLabels.join(' / ') : 'All Trucks';
  const trailerSummary = trailerLabels.length ? trailerLabels.join(' / ') : 'All Trailers';
  const categorySummary = categoryLabels.length ? categoryLabels.join(' / ') : 'All Categories';
  const positionSummary = positionLabels.length ? positionLabels.join(' / ') : 'All Positions';

  if (loading) {
    return (
      <div className="text-center p-5" style={{ fontFamily: 'Arial, sans-serif' }}>
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center p-5 text-danger" style={{ fontFamily: 'Arial, sans-serif' }}>
        {error || 'No data.'}
      </div>
    );
  }

  return (
    <div className="container-fluid" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
      <div className="row mb-1">
        <div className="col-md-6" />
        <div className="col-md-6 text-end" style={{ color: '#444' }}>
          Date: {today}
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-12 text-center">
          <h2 style={{ fontWeight: 'bold', fontSize: '26px' }}>Category Tracking Report</h2>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-12">
          <button
            onClick={() => window.print()}
            className="btn btn-sm btn-secondary mb-2 d-print-none"
          >
            Print
          </button>

          <div className="table-responsive">
            <table className="table table-condensed table-bordered mb-0" style={{ fontSize: '13px' }}>
              <thead>
                <tr className="text-center" style={{ background: '#f5f5f5' }}>
                  <td colSpan={2} style={{ fontWeight: 'bold', fontSize: '15px', padding: '8px' }}>
                    Trucks, Trailers, Categories and Positions
                  </td>
                </tr>
                <tr>
                  <td className="text-end" style={{ padding: '6px 8px' }}>
                    <strong>Date Range:</strong> {dateBegin} ➤ {dateEnd}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 8px' }}>
                    <strong>Trucks:</strong> {truckSummary}
                    {' / '}
                    <strong>Trailers:</strong> {trailerSummary}
                    {' / '}
                    <strong>Categories:</strong> {categorySummary}
                    {' / '}
                    <strong>Positions:</strong> {positionSummary}
                  </td>
                </tr>
              </thead>
            </table>
          </div>

          <div className="table-responsive mt-2">
            <table
              width="100%"
              className="table table-sm table-bordered table-hover table-striped mb-0"
              style={{ fontSize: '13px' }}
            >
              <thead>
                <tr>
                  <th colSpan={9} className="text-center" style={{ fontWeight: 'bold' }}>
                    Categories
                  </th>
                </tr>
                <tr>
                  <th width="4%" className="text-center">No.</th>
                  <th width="8%" className="text-center">Date</th>
                  <th width="12%" className="text-center">Truck</th>
                  <th width="12%" className="text-center">Trailer</th>
                  <th width="18%" className="text-center">Category</th>
                  <th width="12%" className="text-center">Position</th>
                  <th width="16%" className="text-center">Account</th>
                  <th width="9%" className="text-center">Quantity</th>
                  <th width="9%" className="text-center">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted" style={{ padding: '16px' }}>
                      No records found for this period.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="text-center">{idx + 1}</td>
                      <td className="text-center">{row.date}</td>
                      <td className="text-center">{row.truck}</td>
                      <td className="text-center">{row.trailer}</td>
                      <td className="text-center">{row.category}</td>
                      <td className="text-center">{row.position}</td>
                      <td className="text-center">{row.account}</td>
                      <td className="text-end">{fmtQty(row.quantity)}</td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap' }}>{fmt(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f5f5f5' }}>
                  <td colSpan={7} style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                    Total
                  </td>
                  <td className="text-end" style={{ fontWeight: 'bold' }}>
                    {fmtQty(data.total_quantity)}
                  </td>
                  <td className="text-end" style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {fmt(data.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12 text-center" style={{ fontWeight: 'bold', color: '#222' }}>
          Copyright © 2019 - {new Date().getFullYear()}
        </div>
      </div>

      <style>{`
        @media print {
          .d-print-none { display: none !important; }
        }
      `}</style>
    </div>
  );
}
