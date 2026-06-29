import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmt(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function periodLabel(period, dateBegin) {
  if (!dateBegin) return '';
  const d = new Date(dateBegin + 'T00:00:00');
  if (period === 'month') {
    return d.toLocaleString('en-US', { month: 'short' });
  }
  if (period === 'week') {
    return 'Week';
  }
  return d.toLocaleString('en-US', { month: 'short' });
}

function periodTitle(period) {
  if (period === 'month') return 'by Month';
  if (period === 'week') return 'by Week';
  return 'by Period';
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '');
}

export default function FinancialReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = window.location.search;
  const {
    dateBegin,
    dateEnd,
    period,
    carrier,
    drivers,
    trucks,
    trailers,
    dispatchers,
  } = useMemo(() => {
    const searchParams = new URLSearchParams(query);
    return {
      dateBegin: searchParams.get('date_begin') || '',
      dateEnd: searchParams.get('date_end') || '',
      period: searchParams.get('period') || 'month',
      carrier: searchParams.get('carrier') || '',
      drivers: searchParams.getAll('driver'),
      trucks: searchParams.getAll('truck'),
      trailers: searchParams.getAll('trailer'),
      dispatchers: searchParams.getAll('dispatcher'),
    };
  }, [query]);

  useEffect(() => {
    const params = { date_begin: dateBegin, date_end: dateEnd };
    if (carrier) params.carrier = carrier;
    drivers.forEach((id) => {
      if (!params.driver) params.driver = [];
      params.driver.push(id);
    });
    trucks.forEach((id) => {
      if (!params.truck) params.truck = [];
      params.truck.push(id);
    });
    trailers.forEach((id) => {
      if (!params.trailer) params.trailer = [];
      params.trailer.push(id);
    });
    dispatchers.forEach((id) => {
      if (!params.dispatcher) params.dispatcher = [];
      params.dispatcher.push(id);
    });
    reportsService
      .financial(params)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [carrier, dateBegin, dateEnd, dispatchers, drivers, trailers, trucks]);

  const colLabel = periodLabel(period, dateBegin);
  const title = periodTitle(period);
  const companyName = data?.carrier_name || 'JOBEE EXPRESS LLC';
  const dateRange = `${fmtDate(dateBegin)} - ${fmtDate(dateEnd)}`;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#c00' }}>
        {error || 'No data.'}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', color: '#444' }}>{companyName}</div>
        <h2 style={{ margin: '4px 0', fontSize: '22px', color: '#333' }}>
          Profit and Loss {title}
        </h2>
        <div style={{ fontSize: '12px', color: '#666' }}>{dateRange}</div>
      </div>

      <div style={{ textAlign: 'right', marginBottom: '12px' }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#5cb85c', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
        >
          Print
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', width: '50%' }}></th>
            <th style={{ textAlign: 'right', padding: '6px 8px', width: '25%' }}>{colLabel}</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', width: '25%' }}>YTD</th>
          </tr>
        </thead>

        <tbody>
          {/* Incomes section header */}
          <tr style={{ background: '#f5f5f5' }}>
            <td colSpan={3} style={{ padding: '8px', fontWeight: 'bold', fontSize: '15px' }}>
              Incomes
            </td>
          </tr>
          {(data.revenues || []).map((row) => (
            <tr key={row.account_code} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '5px 8px', paddingLeft: '16px' }}>{row.account_name}</td>
              <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(row.amount)}</td>
              <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(row.ytd_amount)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #ccc', fontWeight: 'bold' }}>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>Total income</td>
            <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(data.total_revenues)}</td>
            <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(data.ytd_total_revenues)}</td>
          </tr>

          {/* Spacer */}
          <tr><td colSpan={3} style={{ padding: '8px' }} /></tr>

          {/* Expenses section header */}
          <tr style={{ background: '#f5f5f5' }}>
            <td colSpan={3} style={{ padding: '8px', fontWeight: 'bold', fontSize: '15px' }}>
              Expenses
            </td>
          </tr>
          {(data.expenses || []).map((row) => (
            <tr key={row.account_code} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '5px 8px', paddingLeft: '16px' }}>{row.account_name}</td>
              <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(row.amount)}</td>
              <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(row.ytd_amount)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #ccc', fontWeight: 'bold' }}>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>Total expenses</td>
            <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(data.total_expenses)}</td>
            <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(data.ytd_total_expenses)}</td>
          </tr>

          {/* Spacer */}
          <tr><td colSpan={3} style={{ padding: '8px' }} /></tr>

          {/* Net income */}
          <tr style={{ borderTop: '2px solid #aaa', fontWeight: 'bold' }}>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>Net income</td>
            <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(data.net_profit)}</td>
            <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(data.ytd_net_profit)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: '#888' }}>
        Copyright © 2019 - {new Date().getFullYear()}
      </div>

      <style>{`
        @media print {
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
