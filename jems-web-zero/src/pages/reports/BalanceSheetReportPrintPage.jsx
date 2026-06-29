import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmt(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '');
}

function SectionRows({ section, columns }) {
  return (
    <>
      <tr style={{ background: '#f5f5f5' }}>
        <td colSpan={columns.length + 2} style={{ padding: '8px', fontWeight: 'bold', fontSize: '15px' }}>
          {section.title}
        </td>
      </tr>
      {(section.rows || []).map((row) => (
        <tr key={row.code} style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ padding: '5px 8px', paddingLeft: '16px' }}>{row.name}</td>
          {columns.map((col) => (
            <td key={col.key} style={{ textAlign: 'right', padding: '5px 8px' }}>
              {fmt(row.amounts?.[col.key])}
            </td>
          ))}
          <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(row.total)}</td>
        </tr>
      ))}
      <tr style={{ borderTop: '2px solid #ccc', fontWeight: 'bold' }}>
        <td style={{ padding: '6px 8px', textAlign: 'right' }}>Total {section.title.toLowerCase()}</td>
        {columns.map((col) => (
          <td key={col.key} style={{ textAlign: 'right', padding: '6px 8px' }}>
            {fmt(section.totals?.[col.key])}
          </td>
        ))}
        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(section.total)}</td>
      </tr>
    </>
  );
}

function TotalRow({ label, total, columns, strong = false }) {
  return (
    <tr style={{ borderTop: strong ? '2px solid #aaa' : '1px solid #ddd', fontWeight: 'bold' }}>
      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{label}</td>
      {columns.map((col) => (
        <td key={col.key} style={{ textAlign: 'right', padding: '6px 8px' }}>
          {fmt(total.amounts?.[col.key])}
        </td>
      ))}
      <td style={{ textAlign: 'right', padding: '6px 8px' }}>{fmt(total.total)}</td>
    </tr>
  );
}

export default function BalanceSheetReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = window.location.search;
  const { dateBegin, dateEnd, period, carrier } = useMemo(() => {
    const searchParams = new URLSearchParams(query);
    return {
      dateBegin: searchParams.get('date_begin') || '',
      dateEnd: searchParams.get('date_end') || '',
      period: searchParams.get('period') || '1',
      carrier: searchParams.get('carrier') || '',
    };
  }, [query]);

  useEffect(() => {
    const params = { date_begin: dateBegin, date_end: dateEnd, period };
    if (carrier) params.carrier = carrier;
    reportsService
      .balanceSheet(params)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [carrier, dateBegin, dateEnd, period]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'Arial, sans-serif' }}>Loading...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#c00' }}>
        {error || 'No data.'}
      </div>
    );
  }

  const columns = data.columns || [];
  const companyName = data.carrier_name || 'JOBEE EXPRESS LLC';
  const dateRange = `${fmtDate(dateBegin)} - ${fmtDate(dateEnd)}`;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', color: '#444' }}>{companyName}</div>
        <h2 style={{ margin: '4px 0', fontSize: '22px', color: '#333' }}>Balance Sheet</h2>
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
            <th style={{ textAlign: 'left', padding: '6px 8px', minWidth: '260px' }}></th>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: 'right', padding: '6px 8px' }}>{col.label}</th>
            ))}
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <SectionRows section={data.current_assets} columns={columns} />
          <SectionRows section={data.fixed_assets} columns={columns} />
          <TotalRow label="Total assets" total={data.total_assets} columns={columns} strong />
          <tr><td colSpan={columns.length + 2} style={{ padding: '8px' }} /></tr>
          <SectionRows section={data.current_liabilities} columns={columns} />
          <SectionRows section={data.long_term_liabilities} columns={columns} />
          <TotalRow label="Total liabilities" total={data.total_liabilities} columns={columns} />
          <SectionRows section={data.equity} columns={columns} />
          <TotalRow label="Total liabilities and equity" total={data.total_liabilities_and_equity} columns={columns} strong />
          <TotalRow label="Balance" total={data.balance} columns={columns} strong />
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
