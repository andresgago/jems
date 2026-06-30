import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dic'];
const HIGHCHARTS_BLUE = '#7cb5ec';
const HIGHCHARTS_GREEN = '#90ed7d';
const GRID_COLOR = '#e6e6e6';

function fmtMoney(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(value) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtAxis(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

function monthValue(rows, month, key) {
  const row = (rows || []).find((item) => Number(item.month) === month);
  return Number(row?.[key] || 0);
}

function groupedValues(row, key) {
  return MONTHS.map((_, index) => ({
    month: index + 1,
    current: monthValue(row.monthly, index + 1, key),
    prior: monthValue(row.prior_monthly, index + 1, key),
  }));
}

function deliveryValues(row) {
  return MONTHS.map((_, index) => ({
    month: index + 1,
    current: monthValue(row.monthly_loads, index + 1, 'deliveries'),
    prior: monthValue(row.prior_monthly_loads, index + 1, 'deliveries'),
  }));
}

function pointOnCircle(cx, cy, r, angle) {
  const radians = (angle - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians),
  };
}

function sectorPath(cx, cy, r, startAngle, endAngle) {
  const start = pointOnCircle(cx, cy, r, endAngle);
  const end = pointOnCircle(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function EmbeddedPie({ x, y, r, prior, current }) {
  const priorValue = Math.max(0, Number(prior || 0));
  const currentValue = Math.max(0, Number(current || 0));
  const total = priorValue + currentValue;

  if (total <= 0) {
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill="#f3f3f3" stroke="#d6d6d6" />
        <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="#777">0</text>
      </g>
    );
  }

  const priorAngle = (priorValue / total) * 360;
  if (priorAngle <= 0.01) {
    return <circle cx={x} cy={y} r={r} fill={HIGHCHARTS_BLUE} stroke="#ffffff" strokeWidth="1" />;
  }
  if (priorAngle >= 359.99) {
    return <circle cx={x} cy={y} r={r} fill={HIGHCHARTS_GREEN} stroke="#ffffff" strokeWidth="1" />;
  }

  return (
    <g>
      <path d={sectorPath(x, y, r, 0, priorAngle)} fill={HIGHCHARTS_GREEN} stroke="#ffffff" strokeWidth="1" />
      <path d={sectorPath(x, y, r, priorAngle, 360)} fill={HIGHCHARTS_BLUE} stroke="#ffffff" strokeWidth="1" />
    </g>
  );
}

function RevenueChart({ row, year, priorYear }) {
  const values = groupedValues(row, 'revenue');
  const max = Math.max(1, ...values.flatMap((item) => [item.current, item.prior]));
  const priorTotal = Number(row.prior_revenue || 0);
  const currentTotal = Number(row.revenue || 0);
  const width = 720;
  const height = 245;
  const chartTop = 36;
  const chartHeight = 145;
  const plotLeft = 42;
  const plotWidth = 505;
  const slot = plotWidth / values.length;
  const barWidth = 14;
  const baseline = chartTop + chartHeight;

  return (
    <svg role="img" aria-label={`Revenues ${priorYear} - ${year}`} viewBox={`0 0 ${width} ${height}`} className="w-100 report-chart">
      <text x={width / 2} y="18" textAnchor="middle" fontSize="14" fontWeight="700">
        {row.name}, Revenues {priorYear} - {year}
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = baseline - tick * chartHeight;
        return (
          <g key={tick}>
            <line x1={plotLeft} y1={y} x2={plotLeft + plotWidth} y2={y} stroke={GRID_COLOR} />
            <text x={plotLeft - 7} y={y + 4} textAnchor="end" fontSize="9" fill="#666">{fmtAxis(max * tick)}</text>
          </g>
        );
      })}
      <line x1={plotLeft} y1={baseline} x2={plotLeft + plotWidth} y2={baseline} stroke="#c9c9c9" />
      {values.map((item, index) => {
        const x = plotLeft + index * slot + 6;
        const priorHeight = (item.prior / max) * chartHeight;
        const currentHeight = (item.current / max) * chartHeight;
        return (
          <g key={item.month}>
            <rect x={x} y={baseline - priorHeight} width={barWidth} height={priorHeight} fill={HIGHCHARTS_GREEN} />
            <rect x={x + barWidth + 3} y={baseline - currentHeight} width={barWidth} height={currentHeight} fill={HIGHCHARTS_BLUE} />
            <text x={x + barWidth} y={height - 38} textAnchor="middle" fontSize="10">{MONTHS[index]}</text>
          </g>
        );
      })}
      <EmbeddedPie x={632} y={98} r={39} prior={priorTotal} current={currentTotal} />
      <text x="632" y="151" textAnchor="middle" fontSize="10" fill="#555">Total Revenues</text>
      <rect x="508" y="218" width="10" height="10" fill={HIGHCHARTS_GREEN} />
      <text x="524" y="227" fontSize="11">{priorYear}</text>
      <rect x="578" y="218" width="10" height="10" fill={HIGHCHARTS_BLUE} />
      <text x="594" y="227" fontSize="11">{year}</text>
    </svg>
  );
}

function DeliveriesChart({ row, year, priorYear }) {
  const values = deliveryValues(row);
  const max = Math.max(1, ...values.flatMap((item) => [item.current, item.prior]));
  const priorTotal = Number(row.prior_deliveries || 0);
  const currentTotal = Number(row.deliveries || 0);
  const width = 720;
  const height = 245;
  const chartTop = 38;
  const chartHeight = 143;
  const plotLeft = 42;
  const plotWidth = 505;
  const baseline = chartTop + chartHeight;
  const slot = plotWidth / 11;

  function points(key) {
    return values.map((item, index) => {
      const x = plotLeft + index * slot;
      const y = baseline - (item[key] / max) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
  }

  return (
    <svg role="img" aria-label={`Deliveries ${priorYear} - ${year}`} viewBox={`0 0 ${width} ${height}`} className="w-100 report-chart">
      <text x={width / 2} y="18" textAnchor="middle" fontSize="14" fontWeight="700">
        {row.name}, Deliveries {priorYear} - {year}
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = baseline - tick * chartHeight;
        return (
          <g key={tick}>
            <line x1={plotLeft} y1={y} x2={plotLeft + plotWidth} y2={y} stroke={GRID_COLOR} />
            <text x={plotLeft - 7} y={y + 4} textAnchor="end" fontSize="9" fill="#666">{fmtAxis(max * tick)}</text>
          </g>
        );
      })}
      <line x1={plotLeft} y1={baseline} x2={plotLeft + plotWidth} y2={baseline} stroke="#c9c9c9" />
      <polyline points={points('prior')} fill="none" stroke={HIGHCHARTS_GREEN} strokeWidth="3" />
      <polyline points={points('current')} fill="none" stroke={HIGHCHARTS_BLUE} strokeWidth="3" />
      {values.map((item, index) => {
        const x = plotLeft + index * slot;
        const priorY = baseline - (item.prior / max) * chartHeight;
        const currentY = baseline - (item.current / max) * chartHeight;
        return (
          <g key={item.month}>
            <circle cx={x} cy={priorY} r="3" fill="black" stroke={HIGHCHARTS_GREEN} strokeWidth="2" />
            <circle cx={x} cy={currentY} r="3" fill="black" stroke={HIGHCHARTS_BLUE} strokeWidth="2" />
            <text x={x} y={height - 38} textAnchor="middle" fontSize="10">{MONTHS[index]}</text>
          </g>
        );
      })}
      <EmbeddedPie x={632} y={98} r={35} prior={priorTotal} current={currentTotal} />
      <text x="632" y="147" textAnchor="middle" fontSize="10" fill="#555">Deliveries</text>
      <rect x="508" y="218" width="10" height="10" fill={HIGHCHARTS_GREEN} />
      <text x="524" y="227" fontSize="11">{priorYear}</text>
      <rect x="578" y="218" width="10" height="10" fill={HIGHCHARTS_BLUE} />
      <text x="594" y="227" fontSize="11">{year}</text>
    </svg>
  );
}

function SummaryRow({ row, index, year, priorYear }) {
  return (
    <tr className="report-tr">
      <td>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
          <span className="badge rounded-pill text-bg-primary report-indicator-main">
            {index ? `${index} ${row.name}` : row.name}
          </span>
          <span className="report-indicator-detail">
            <small>{row.name} Revenues {year}:</small> {fmtMoney(row.revenue)}
          </span>
        </div>

        <RevenueChart row={row} year={year} priorYear={priorYear} />

        <div className="d-flex justify-content-end mb-2">
          <span className="report-indicator-detail">
            <small>{row.name} Deliveries {year}:</small> {fmtInt(row.deliveries)}
          </span>
        </div>

        <DeliveriesChart row={row} year={year} priorYear={priorYear} />
      </td>
    </tr>
  );
}

export default function BrokerSummaryReportPrintPage() {
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
      .brokerSummary({ year, option })
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [option, year]);

  const today = new Date().toISOString().slice(0, 10);
  const priorYear = data?.prior_year || year - 1;
  const rows = option === 0 ? data?.brokers || [] : data?.total ? [data.total] : [];
  const heading = option === 0 ? 'Annual by brokers' : 'Annual Total';

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
          <h2 style={{ fontWeight: 'bold', fontSize: '26px' }}>Broker Summary</h2>
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

      <div className="table-responsive">
        <table className="table table-sm table-bordered table-striped">
          <thead>
            <tr>
              <th className="text-center">Revenues / Deliveries</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-center text-muted" style={{ padding: '18px' }}>
                  No broker revenue for {year}.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <SummaryRow
                  key={row.id || 'total'}
                  row={row}
                  index={option === 0 ? idx + 1 : 0}
                  year={year}
                  priorYear={priorYear}
                />
              ))
            )}
            <tr className="report-tr">
              <td className="text-end">
                <span className="report-indicator-main-value">
                  Total Revenues {year}: {fmtMoney(data.total_revenue)}
                  <br />
                  Total Deliveries {year}: {fmtInt(data.total_deliveries)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="row mt-4">
        <div className="col-12 text-center" style={{ fontWeight: 'bold', color: '#222' }}>
          Copyright (c) 2019 - {new Date().getFullYear()}
        </div>
      </div>

      <style>{`
        .report-chart {
          min-height: 220px;
          max-height: 260px;
          border: 1px solid #e1e4e8;
          background: #fff;
          margin: 6px 0 12px;
        }
        .report-indicator-main {
          font-size: 15px;
          padding: 8px 12px;
          border-radius: 4px !important;
        }
        .report-indicator-detail {
          display: inline-block;
          border: 1px solid #d6d8db;
          background: #f7f7f7;
          padding: 6px 10px;
          font-size: 15px;
        }
        .report-indicator-detail small {
          color: #555;
          margin-right: 4px;
        }
        .report-indicator-main-value {
          display: inline-block;
          font-size: 20px;
          font-weight: 700;
          padding: 10px;
        }
        .report-tr td {
          padding: 12px;
        }
        @media print {
          .d-print-none { display: none !important; }
          .report-chart { break-inside: avoid; }
          .report-tr { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
