import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmt(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function SectionTable({ title, section, showRevenue }) {
  if (!section) return null;
  const colSpanLabel = showRevenue ? 5 : 4;

  return (
    <div className="table-responsive mb-3">
      <table width="100%" className="table table-sm table-bordered table-hover table-striped mb-0">
        <thead>
          <tr>
            <th colSpan={showRevenue ? 7 : 6} className="text-center fw-bold">
              {title}
            </th>
          </tr>
          <tr>
            <th width="5%" className="text-center">No.</th>
            <th width="20%" className="text-start">Name</th>
            <th width="15%" className="text-center">Email</th>
            <th width="20%" className="text-center">Address</th>
            <th width="15%" className="text-center">SSN</th>
            {showRevenue && (
              <th width="12%" className="text-end">Revenues</th>
            )}
            <th width="13%" className="text-end">Tax</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((r, idx) => (
            <tr key={r.id}>
              <td className="text-center">{idx + 1}</td>
              <td className="text-start">
                {r.name}
                {(r.status === 0 || r.is_active === false) && (
                  <span className="text-danger ms-1" title="Inactive">✕</span>
                )}
              </td>
              <td className="text-start">{r.email || '–'}</td>
              <td className="text-start">{r.address || '–'}</td>
              <td className="text-center">{r.ssn || '–'}</td>
              {showRevenue && (
                <td className="text-end">{fmt(r.revenue)}</td>
              )}
              <td className="text-end">{fmt(r.tax)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="fw-bold">
            <td colSpan={colSpanLabel} className="text-start">{title} Total</td>
            {showRevenue && (
              <td className="text-end">{fmt(section.total_revenue)}</td>
            )}
            <td className="text-end">{fmt(section.total_tax)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function TaxReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { dateBegin, dateEnd, option, carrier } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      dateBegin: params.get('date_begin') || '',
      dateEnd: params.get('date_end') || '',
      option: Number(params.get('option') || 0),
      carrier: params.get('carrier') || '',
    };
  }, []);

  useEffect(() => {
    if (!dateBegin || !dateEnd) {
      setError('Missing date range.');
      setLoading(false);
      return;
    }
    const params = { date_begin: dateBegin, date_end: dateEnd, option };
    if (carrier) params.carrier = carrier;
    reportsService
      .tax(params)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load Tax Report.'))
      .finally(() => setLoading(false));
  }, [dateBegin, dateEnd, option, carrier]);

  if (loading) return <div className="text-center p-5">Loading…</div>;
  if (error) return <div className="alert alert-danger m-3">{error}</div>;

  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const showRevenue = option === 1;

  const grandTotalTax =
    (data.drivers?.total_tax || 0) +
    (data.owners?.total_tax || 0) +
    (data.dispatchers?.total_tax || 0);
  const grandTotalRevenue = showRevenue
    ? (data.drivers?.total_revenue || 0) +
      (data.owners?.total_revenue || 0) +
      (data.dispatchers?.total_revenue || 0)
    : 0;

  return (
    <div className="container-fluid py-3">
      {/* Generated on */}
      <div className="row mb-1">
        <div className="col text-end">
          <small>Generated on: {today}</small>
        </div>
      </div>

      {/* Title */}
      <div className="row mb-3">
        <div className="col text-center">
          <h2 style={{ color: '#222' }}>Tax Report</h2>
        </div>
      </div>

      {/* Header table */}
      <div className="table-responsive mb-3">
        <table className="table table-sm table-bordered mb-0">
          <thead>
            <tr className="table-light">
              <th colSpan={2} className="text-center fw-bold">
                Drivers, Owner Operators and Dispatchers
              </th>
            </tr>
            <tr>
              <td colSpan={2} className="text-end fw-bold">
                <strong>Date Range:</strong>{' '}
                {fmtDate(dateBegin)} ➤ {fmtDate(dateEnd)}
              </td>
            </tr>
          </thead>
        </table>
      </div>

      {/* Drivers */}
      <SectionTable title="Drivers" section={data.drivers} showRevenue={showRevenue} />

      {/* Owner Operators */}
      <SectionTable title="Owner Operators" section={data.owners} showRevenue={showRevenue} />

      {/* Dispatchers */}
      <SectionTable title="Dispatchers" section={data.dispatchers} showRevenue={showRevenue} />

      {/* Grand Total */}
      <div className="table-responsive mb-4">
        <table width="100%" className="table table-sm table-bordered mb-0">
          <thead>
            <tr className="table-light">
              <th colSpan={showRevenue ? 2 : 1} className="text-center fw-bold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="fw-bold">
              <td className="text-start" style={{ width: showRevenue ? '70%' : '85%' }}>
                Total
              </td>
              {showRevenue && (
                <td className="text-end" style={{ width: '15%' }}>
                  {fmt(grandTotalRevenue)}
                </td>
              )}
              <td className="text-end" style={{ width: '15%' }}>
                {fmt(grandTotalTax)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-center mt-5">
        <small className="fw-bold">Copyright © 2019 - {new Date().getFullYear()}</small>
      </div>
    </div>
  );
}
