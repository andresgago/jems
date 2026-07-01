import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmtMoney(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtQty(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function SummaryTable({ section }) {
  return (
    <div className="table-responsive mb-4">
      <table width="100%" className="table table-sm table-bordered table-hover table-striped mb-0" style={{ fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#d0e8f0' }}>
            <th colSpan={7} className="text-center" style={{ fontSize: '14px' }}>
              Truck: {section.truck_label}
            </th>
          </tr>
          <tr>
            <th width="5%" className="text-center">No.</th>
            <th width="20%" className="text-center">Code</th>
            <th width="30%" className="text-left">Name</th>
            <th className="text-center">Quantity</th>
            <th className="text-center">Spent</th>
            <th className="text-center">Average Price</th>
            <th className="text-center">Details</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.no}>
              <td className="text-center">{row.no}</td>
              <td className="text-center">{row.code}</td>
              <td>{row.name}</td>
              <td className="text-center">{fmtQty(row.quantity)}</td>
              <td className="text-center">{fmtMoney(row.spent)}</td>
              <td className="text-center">{fmtMoney(row.average_price)}</td>
              <td dangerouslySetInnerHTML={{ __html: row.details || '—' }} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f5f5f5' }}>
            <th colSpan={3} />
            <th className="text-center">{fmtQty(section.total_quantity)}</th>
            <th className="text-center">{fmtMoney(section.total_spent)}</th>
            <th className="text-center">{fmtMoney(section.total_average_price)}</th>
            <th />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ListingTable({ section }) {
  return (
    <div className="table-responsive mb-4">
      <table width="100%" className="table table-sm table-bordered table-hover table-striped mb-0" style={{ fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#d0e8f0' }}>
            <th colSpan={7} className="text-center" style={{ fontSize: '14px' }}>
              Truck: {section.truck_label}
            </th>
          </tr>
          <tr>
            <th width="5%" className="text-center">No.</th>
            <th width="10%" className="text-center">Date</th>
            <th width="20%" className="text-center">Code</th>
            <th width="20%" className="text-left">Name</th>
            <th className="text-center">Quantity</th>
            <th className="text-center">Amount</th>
            <th className="text-center">Details</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr key={row.no}>
              <td className="text-center">{row.no}</td>
              <td className="text-center">{row.date}</td>
              <td className="text-center">{row.code}</td>
              <td>{row.name}</td>
              <td className="text-center">{fmtQty(row.quantity)}</td>
              <td className="text-center">{fmtMoney(row.amount)}</td>
              <td>
                <span dangerouslySetInnerHTML={{ __html: row.details || '' }} />
                {row.detail && (
                  <><br /><small><strong>{row.detail}</strong></small></>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f5f5f5' }}>
            <th colSpan={4} />
            <th className="text-center">{fmtQty(section.total_quantity)}</th>
            <th className="text-center">{fmtMoney(section.total_spent)}</th>
            <th />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function TruckPartsReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      dateBegin: p.get('date_begin') || '',
      dateEnd: p.get('date_end') || '',
      dateOption: Number(p.get('date_option') || 1),
      report: Number(p.get('report') || 1),
      trucks: p.getAll('truck'),
      categoryTypes: p.getAll('category_type'),
      partGroups: p.getAll('part_group'),
      categories: p.getAll('category'),
      truckLabels: p.getAll('truck_label'),
      categoryTypeLabels: p.getAll('category_type_label'),
      partGroupLabels: p.getAll('part_group_label'),
      categoryLabels: p.getAll('category_label'),
    };
  }, []);

  useEffect(() => {
    const apiParams = {
      date_begin: params.dateBegin,
      date_end: params.dateEnd,
      date_option: params.dateOption,
      report: params.report,
    };
    if (params.trucks.length) apiParams.truck = params.trucks;
    if (params.categoryTypes.length) apiParams.category_type = params.categoryTypes;
    if (params.partGroups.length) apiParams.part_group = params.partGroups;
    if (params.categories.length) apiParams.category = params.categories;

    reportsService
      .truckParts(apiParams)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [params]);

  const today = new Date().toISOString().slice(0, 10);

  const truckSummary = params.truckLabels.length ? params.truckLabels.join(' / ') : 'All';
  const ctSummary = params.categoryTypeLabels.length ? params.categoryTypeLabels.join(' / ') : 'All';
  const pgSummary = params.partGroupLabels.length ? params.partGroupLabels.join(' / ') : 'All';
  const catSummary = params.categoryLabels.length ? params.categoryLabels.join(' / ') : 'All';
  const dateRangeLabel = params.dateOption === 3
    ? 'All'
    : `${params.dateBegin} ➤ ${params.dateEnd}`;
  const reportTitle = params.report === 2
    ? 'Parts and Pieces Used By Trucks (Listing)'
    : 'Parts and Pieces Used By Trucks (Summary)';

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
        <div className="col-12">
          <button
            onClick={() => window.print()}
            className="btn btn-sm btn-secondary mb-2 d-print-none"
          >
            Print
          </button>

          {/* Report header table */}
          <div className="table-responsive">
            <table className="table table-sm table-bordered mb-2" style={{ fontSize: '13px' }}>
              <thead>
                <tr className="text-center" style={{ background: '#f5f5f5' }}>
                  <td colSpan={2} style={{ fontWeight: 'bold', fontSize: '16px', padding: '8px' }}>
                    {reportTitle}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 8px' }}>
                    <strong>Date Range:</strong> {dateRangeLabel}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 8px' }}>
                    <strong>Trucks:</strong> {truckSummary}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 8px' }}>
                    <strong>Category Type:</strong> {ctSummary}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 8px' }}>
                    <strong>Truck Part Group:</strong> {pgSummary}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px 8px' }}>
                    <strong>Category:</strong> {catSummary}
                  </td>
                </tr>
              </thead>
            </table>
          </div>

          {/* Data sections */}
          {data.sections.length === 0 ? (
            <div className="alert alert-info">
              There are no parts and pieces for that selection.
            </div>
          ) : (
            data.sections.map((section) =>
              params.report === 2
                ? <ListingTable key={section.truck_id ?? 'all'} section={section} />
                : <SummaryTable key={section.truck_id ?? 'all'} section={section} />
            )
          )}
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
