import { useEffect, useMemo, useState } from 'react';
import { reportsService } from '../../services/reports';

function fmt(value) {
  const n = Number(value || 0);
  return `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function invoiceNumber(number) {
  return String(number).startsWith('JE-DRI') ? String(number) : `JE-DRI ${number}`;
}

function selectionLabel(driverIds, invoiceIds) {
  const parts = [];
  if (driverIds.length) parts.push('Driver');
  if (invoiceIds.length) parts.push('Invoice');
  if (!parts.length) return 'Summary Total';
  return `Summary With Selection [${parts.join(', ')}]`;
}

function DriverBreakdown({ details }) {
  if (!details?.drivers?.length) return null;
  return (
    <>
      <tr>
        <td colSpan={2} style={{ padding: '5px 8px', fontWeight: 700, fontSize: '13px' }}>Drivers</td>
      </tr>
      {details.drivers.map((driver) => (
        <tr key={driver.id}>
          <td style={{ padding: '5px 8px 5px 26px', fontSize: '13px' }}>Driver: {driver.name}</td>
          <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '13px' }}>{fmt(driver.amount)}</td>
        </tr>
      ))}
      <tr><td colSpan={2} style={{ height: '12px' }} /></tr>
    </>
  );
}

function AccountRows({ rows, showDetails }) {
  return (rows || []).map((row) => (
    <tbody key={row.account_code}>
      <tr>
        <td style={{ padding: '7px 14px', fontSize: '16px', fontWeight: showDetails ? 700 : 400 }}>
          {row.account_name}
        </td>
        <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: '16px', fontWeight: showDetails ? 700 : 400 }}>
          {fmt(row.amount)}
        </td>
      </tr>
      {showDetails && <DriverBreakdown details={row.details} />}
    </tbody>
  ));
}

export default function InvoiceReportPrintPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = window.location.search;
  const { dateBegin, dateEnd, carrier, drivers, invoices } = useMemo(() => {
    const searchParams = new URLSearchParams(query);
    return {
      dateBegin: searchParams.get('date_begin') || '',
      dateEnd: searchParams.get('date_end') || '',
      carrier: searchParams.get('carrier') || '',
      drivers: searchParams.getAll('driver'),
      invoices: searchParams.getAll('invoice'),
    };
  }, [query]);

  useEffect(() => {
    const params = { date_begin: dateBegin, date_end: dateEnd };
    if (carrier) params.carrier = carrier;
    drivers.forEach((id) => {
      if (!params.driver) params.driver = [];
      params.driver.push(id);
    });
    invoices.forEach((id) => {
      if (!params.invoice) params.invoice = [];
      params.invoice.push(id);
    });
    reportsService
      .invoice(params)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [carrier, dateBegin, dateEnd, drivers, invoices]);

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

  const hasSelection = drivers.length > 0 || invoices.length > 0;
  const invoiceLabels = (data.invoices || []).map((invoice) => invoiceNumber(invoice.number));

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', padding: '18px 30px' }}>
      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', marginBottom: '20px' }}>
        Date: {todayIso()}
      </div>

      <h1 style={{ textAlign: 'center', fontSize: '30px', margin: '0 0 8px', fontWeight: 700 }}>
        Profit and Loss By Invoices
      </h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '15px' }}>
        <thead>
          <tr>
            <th colSpan={2} style={{ border: '1px solid #ddd', padding: '7px', textAlign: 'center', fontSize: '20px' }}>
              {selectionLabel(drivers, invoices)}
            </th>
          </tr>
          <tr>
            <td colSpan={2} style={{ border: '1px solid #ddd', padding: '9px' }}>
              <strong>Invoices: </strong>
              {invoiceLabels.length ? invoiceLabels.map((label, index) => (
                <span key={`${label}-${index}`}>
                  {index > 0 ? ' / ' : ''}
                  <strong>{label}</strong>
                </span>
              )) : <strong>All Invoices</strong>}
            </td>
          </tr>
        </thead>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
        <thead>
          <tr>
            <th style={{ width: '70%', border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
              Management Indicators
            </th>
            <th style={{ width: '30%', border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
              Amount
            </th>
          </tr>
        </thead>

        <tbody>
          <tr style={{ background: '#f7f7f7' }}>
            <td style={{ border: '1px solid #ddd', padding: '10px 14px', fontSize: '26px', fontWeight: 700 }}>
              TOTAL REVENUES
            </td>
            <td style={{ border: '1px solid #ddd', padding: '10px 8px', textAlign: 'right', fontSize: '26px', fontWeight: 700 }}>
              {fmt(data.total_revenues)}
            </td>
          </tr>
        </tbody>
        <AccountRows rows={data.revenues} showDetails={hasSelection} />

        <tbody>
          <tr><td colSpan={2} style={{ border: '1px solid #ddd', height: '12px' }} /></tr>
          <tr style={{ background: '#f7f7f7' }}>
            <td style={{ border: '1px solid #ddd', padding: '10px 14px', fontSize: '26px', fontWeight: 700 }}>
              TOTAL EXPENSES
            </td>
            <td style={{ border: '1px solid #ddd', padding: '10px 8px', textAlign: 'right', fontSize: '26px', fontWeight: 700 }}>
              {fmt(data.total_expenses)}
            </td>
          </tr>
        </tbody>
        <AccountRows rows={data.expenses} showDetails={hasSelection} />

        <tbody>
          <tr><td colSpan={2} style={{ border: '1px solid #ddd', height: '12px' }} /></tr>
          <tr style={{ background: '#f7f7f7' }}>
            <td style={{ border: '1px solid #ddd', padding: '10px 14px', fontSize: '26px', fontWeight: 700 }}>
              NET PROFIT
            </td>
            <td style={{ border: '1px solid #ddd', padding: '10px 8px', textAlign: 'right', fontSize: '26px', fontWeight: 700 }}>
              {fmt(data.net_profit)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: '100px', fontWeight: 700, fontSize: '14px' }}>
        Copyright © 2019 - {new Date().getFullYear()}
      </div>
    </div>
  );
}
