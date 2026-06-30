import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dic'];
const CHART_COLORS = [
  '#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9',
  '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1',
];
const GRID_COLOR = '#e6e6e6';

function fmtInt(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pairName(pair) {
  return `${pair.shipper} to ${pair.receiver}`;
}

function monthlyCount(pair, month) {
  const row = (pair.monthly || []).find((item) => Number(item.month) === month);
  return Number(row?.count || 0);
}

function axisTicks(max) {
  return [0, 0.25, 0.5, 0.75, 1].map((tick) => ({
    tick,
    value: Math.round(max * tick),
  }));
}

function AnnualChart({ pairs, year }) {
  const max = Math.max(1, ...pairs.map((pair) => Number(pair.total || 0)));
  const width = 980;
  const height = 360;
  const plotLeft = 54;
  const plotRight = 24;
  const plotTop = 42;
  const plotHeight = 210;
  const plotWidth = width - plotLeft - plotRight;
  const baseline = plotTop + plotHeight;
  const slot = plotWidth / Math.max(pairs.length, 1);
  const barWidth = Math.max(8, Math.min(28, slot * 0.56));

  return (
    <svg role="img" aria-label={`Deliveries from shipper to receiver ${year}`} viewBox={`0 0 ${width} ${height}`} className="w-100 report-chart">
      <text x={width / 2} y="22" textAnchor="middle" fontSize="15" fontWeight="700">{year}</text>
      {axisTicks(max).map(({ tick, value }) => {
        const y = baseline - tick * plotHeight;
        return (
          <g key={tick}>
            <line x1={plotLeft} y1={y} x2={plotLeft + plotWidth} y2={y} stroke={GRID_COLOR} />
            <text x={plotLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#666">{value}</text>
          </g>
        );
      })}
      <line x1={plotLeft} y1={baseline} x2={plotLeft + plotWidth} y2={baseline} stroke="#c9c9c9" />
      {pairs.map((pair, index) => {
        const value = Number(pair.total || 0);
        const x = plotLeft + index * slot + (slot - barWidth) / 2;
        const h = (value / max) * plotHeight;
        return (
          <g key={`${pair.shipper}-${pair.receiver}-${index}`}>
            <rect x={x} y={baseline - h} width={barWidth} height={h} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            <text x={x + barWidth / 2} y={baseline - h - 5} textAnchor="middle" fontSize="10" fill="#333">{value}</text>
          </g>
        );
      })}
      <text x={plotLeft + plotWidth / 2} y={height - 80} textAnchor="middle" fontSize="12">Deliveries</text>
      <g transform={`translate(${plotLeft}, ${height - 58})`}>
        {pairs.slice(0, 10).map((pair, index) => (
          <g key={`${pair.shipper}-${pair.receiver}`} transform={`translate(${(index % 2) * 455}, ${Math.floor(index / 2) * 18})`}>
            <rect x="0" y="0" width="10" height="10" fill={CHART_COLORS[index % CHART_COLORS.length]} />
            <text x="16" y="10" fontSize="11">{pairName(pair)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function MonthlyChart({ pairs, year }) {
  const max = Math.max(
    1,
    ...pairs.flatMap((pair) => MONTHS.map((_, index) => monthlyCount(pair, index + 1))),
  );
  const width = 980;
  const height = 405;
  const plotLeft = 54;
  const plotRight = 24;
  const plotTop = 42;
  const plotHeight = 230;
  const plotWidth = width - plotLeft - plotRight;
  const baseline = plotTop + plotHeight;
  const monthSlot = plotWidth / MONTHS.length;
  const seriesWidth = Math.max(3, Math.min(8, (monthSlot - 12) / Math.max(pairs.length, 1)));

  return (
    <svg role="img" aria-label={`Monthly deliveries from shipper to receiver ${year}`} viewBox={`0 0 ${width} ${height}`} className="w-100 report-chart">
      <text x={width / 2} y="22" textAnchor="middle" fontSize="15" fontWeight="700">{year}</text>
      {axisTicks(max).map(({ tick, value }) => {
        const y = baseline - tick * plotHeight;
        return (
          <g key={tick}>
            <line x1={plotLeft} y1={y} x2={plotLeft + plotWidth} y2={y} stroke={GRID_COLOR} />
            <text x={plotLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#666">{value}</text>
          </g>
        );
      })}
      <line x1={plotLeft} y1={baseline} x2={plotLeft + plotWidth} y2={baseline} stroke="#c9c9c9" />
      {MONTHS.map((month, monthIndex) => (
        <g key={month}>
          <text x={plotLeft + monthIndex * monthSlot + monthSlot / 2} y={baseline + 18} textAnchor="middle" fontSize="10">{month}</text>
          {pairs.map((pair, pairIndex) => {
            const value = monthlyCount(pair, monthIndex + 1);
            const groupWidth = seriesWidth * pairs.length;
            const x = plotLeft + monthIndex * monthSlot + (monthSlot - groupWidth) / 2 + pairIndex * seriesWidth;
            const h = (value / max) * plotHeight;
            return (
              <rect
                key={`${month}-${pair.shipper}-${pair.receiver}`}
                x={x}
                y={baseline - h}
                width={seriesWidth - 1}
                height={h}
                fill={CHART_COLORS[pairIndex % CHART_COLORS.length]}
              />
            );
          })}
        </g>
      ))}
      <g transform={`translate(${plotLeft}, ${height - 86})`}>
        {pairs.map((pair, index) => (
          <g key={`${pair.shipper}-${pair.receiver}`} transform={`translate(${(index % 2) * 455}, ${Math.floor(index / 2) * 18})`}>
            <rect x="0" y="0" width="10" height="10" fill={CHART_COLORS[index % CHART_COLORS.length]} />
            <text x="16" y="10" fontSize="11">{pairName(pair)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function AnnualTable({ pairs }) {
  return (
    <table className="table table-sm table-bordered table-striped mb-0" style={{ fontSize: '12px' }}>
      <thead>
        <tr>
          <th width="6%" className="text-center">No.</th>
          <th>Shipper</th>
          <th>Receiver</th>
          <th width="14%" className="text-end">Deliveries</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((pair, index) => (
          <tr key={`${pair.shipper}-${pair.receiver}-${index}`}>
            <td className="text-center">{index + 1}</td>
            <td>{pair.shipper}</td>
            <td>{pair.receiver}</td>
            <td className="text-end">{fmtInt(pair.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MonthlyTable({ pairs }) {
  return (
    <table className="table table-sm table-bordered table-striped mb-0" style={{ fontSize: '12px' }}>
      <thead>
        <tr>
          <th>Shipper to Receiver</th>
          {MONTHS.map((month) => <th key={month} className="text-end">{month}</th>)}
          <th className="text-end">Total</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((pair, index) => (
          <tr key={`${pair.shipper}-${pair.receiver}-${index}`}>
            <td>{pairName(pair)}</td>
            {MONTHS.map((_, monthIndex) => (
              <td key={monthIndex + 1} className="text-end">{fmtInt(monthlyCount(pair, monthIndex + 1))}</td>
            ))}
            <td className="text-end fw-bold">{fmtInt(pair.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ShipperReceiverReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { year, option } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      year: Number(params.get('year') || new Date().getFullYear()),
      option: Number(params.get('option') || 0),
    };
  }, []);

  useEffect(() => {
    reportsService
      .shipperReceiver({ year, option })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [option, year]);

  const today = new Date().toISOString().slice(0, 10);
  const pairs = data?.pairs || [];
  const heading = option === 0 ? 'Annual Total (Top 30)' : 'By Months (Top 10)';

  if (loading) {
    return <div className="text-center p-5" style={{ fontFamily: 'Arial, sans-serif' }}>Loading...</div>;
  }

  if (error || !data) {
    return <div className="text-center p-5 text-danger" style={{ fontFamily: 'Arial, sans-serif' }}>{error || 'No data.'}</div>;
  }

  return (
    <div className="container-fluid py-3" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
      <div className="row mb-1">
        <div className="col-md-6" />
        <div className="col-md-6 text-end">Date: {today}</div>
      </div>

      <div className="row mb-3">
        <div className="col-12 text-center">
          <h2 style={{ fontWeight: 'bold', fontSize: '26px' }}>Deliveries from Shipper to Receiver</h2>
        </div>
      </div>

      <button onClick={() => window.print()} className="btn btn-sm btn-secondary mb-2 d-print-none">
        Print
      </button>

      <div className="table-responsive mb-2">
        <table className="table table-condensed table-bordered mb-0">
          <thead>
            <tr className="text-center" style={{ background: '#f5f5f5' }}>
              <td style={{ fontWeight: 'bold', fontSize: '15px', padding: '8px' }}>{heading}</td>
            </tr>
            <tr>
              <td className="text-end" style={{ padding: '6px 8px' }}>
                <strong>Year:</strong> {year}
              </td>
            </tr>
          </thead>
        </table>
      </div>

      <div className="d-flex justify-content-end mb-2">
        <span className="report-indicator-detail">
          <small>Total Deliveries:</small> {fmtInt(data.total_deliveries)}
        </span>
      </div>

      {pairs.length === 0 ? (
        <div className="text-center text-muted border p-4">No executed loads with shipper and receiver for {year}.</div>
      ) : (
        <>
          {option === 0 ? (
            <AnnualChart pairs={pairs} year={year} />
          ) : (
            <MonthlyChart pairs={pairs} year={year} />
          )}
          <div className="table-responsive mt-3">
            {option === 0 ? <AnnualTable pairs={pairs} /> : <MonthlyTable pairs={pairs} />}
          </div>
        </>
      )}

      <div className="row mt-4">
        <div className="col-12 text-center" style={{ fontWeight: 'bold', color: '#222' }}>
          Copyright (c) 2019 - {new Date().getFullYear()}
        </div>
      </div>

      <style>{`
        .report-chart {
          min-height: 300px;
          border: 1px solid #e1e4e8;
          background: #fff;
        }
        .report-indicator-detail {
          display: inline-block;
          border: 1px solid #d6d8db;
          background: #f7f7f7;
          padding: 6px 10px;
          font-size: 15px;
          font-weight: 700;
        }
        .report-indicator-detail small {
          color: #555;
          margin-right: 4px;
          font-weight: 400;
        }
        @media print {
          .d-print-none { display: none !important; }
          .report-chart { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
