import { useEffect, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { reportsService } from '../../services/reports';
import api from '../../services/api';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = `${today.getFullYear()}-01-01`;

function fmt(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function buildSelectionLabel(selDrivers, selInvoices) {
  const parts = [];
  if (selDrivers.length) parts.push('Driver');
  if (selInvoices.length) parts.push('Invoice');
  if (!parts.length) return 'Summary Total';
  return `Summary With Selection [${parts.join(', ')}]`;
}

function DriverBreakdown({ details }) {
  if (!details?.drivers?.length) return null;
  return (
    <>
      <tr className="table-secondary">
        <td colSpan={2} className="small fw-semibold ps-4 py-1">Drivers</td>
      </tr>
      {details.drivers.map((d) => (
        <tr key={d.id}>
          <td className="ps-5 small text-muted">Driver: {d.name}</td>
          <td className="text-end small text-muted">{fmt(d.amount)}</td>
        </tr>
      ))}
      <tr><td colSpan={2} className="py-1" /></tr>
    </>
  );
}

export default function InvoiceReportPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selDrivers, setSelDrivers] = useState([]);
  const [selInvoices, setSelInvoices] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const [invoiceOptions, setInvoiceOptions] = useState([]);

  useEffect(() => {
    api.get('/drivers/options/').then((r) => setDriverOptions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = { date_begin: start, date_end: end };
    if (selDrivers.length) params.driver = selDrivers;
    api.get('/accounting/driver-invoices/options/', { params })
      .then((r) => setInvoiceOptions(r.data))
      .catch(() => {});
    setSelInvoices([]);
  }, [start, end, selDrivers]);

  const hasFilter = selDrivers.length > 0 || selInvoices.length > 0;
  const selectionLabel = buildSelectionLabel(selDrivers, selInvoices);

  function run() {
    setLoading(true);
    setError(null);
    setData(null);
    const params = { date_begin: start, date_end: end };
    if (selDrivers.length) params.driver = selDrivers.join(',');
    if (selInvoices.length) params.invoice = selInvoices.join(',');
    reportsService
      .invoice(params)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }

  const invoiceLabel = data?.invoices?.length
    ? data.invoices.map((i) => `DI ${i.number}`).join(' / ')
    : 'All Invoices';

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <h5 className="mb-0">Profit and Loss</h5>
        <DateRangePicker
          start={start}
          end={end}
          onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }}
        />
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <label htmlFor="filter-drivers" className="form-label fw-semibold small mb-1">
            Select Driver
          </label>
          <select
            id="filter-drivers"
            className="form-select form-select-sm"
            multiple
            size={Math.min(driverOptions.length || 1, 5)}
            value={selDrivers.map(String)}
            onChange={(e) => setSelDrivers(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
            style={{ minHeight: '60px' }}
          >
            {driverOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          {selDrivers.length > 0 && (
            <button type="button" className="btn btn-link btn-sm p-0 mt-1 text-secondary"
              onClick={() => { setSelDrivers([]); setSelInvoices([]); }}>
              Clear
            </button>
          )}
        </div>
        <div className="col-md-4">
          <label htmlFor="filter-invoices" className="form-label fw-semibold small mb-1">
            Select Invoice
          </label>
          <select
            id="filter-invoices"
            className="form-select form-select-sm"
            multiple
            size={Math.min(invoiceOptions.length || 1, 5)}
            value={selInvoices.map(String)}
            onChange={(e) => setSelInvoices(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
            style={{ minHeight: '60px' }}
          >
            {invoiceOptions.map((i) => (
              <option key={i.id} value={i.id}>DI {i.number}</option>
            ))}
          </select>
          {selInvoices.length > 0 && (
            <button type="button" className="btn btn-link btn-sm p-0 mt-1 text-secondary"
              onClick={() => setSelInvoices([])}>
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <div>
          <table className="table table-sm table-bordered mb-0">
            <thead>
              <tr className="table-dark text-center">
                <th colSpan={2}>{selectionLabel}</th>
              </tr>
              <tr>
                <td colSpan={2}>
                  <strong>Invoices: </strong>{invoiceLabel}
                </td>
              </tr>
            </thead>
          </table>

          <table className="table table-sm table-bordered table-hover table-striped">
            <thead>
              <tr className="table-light">
                <th style={{ width: '70%' }}>Management Indicators</th>
                <th className="text-end" style={{ width: '30%' }}>Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr className="table-primary">
                <td className="fw-bold">TOTAL REVENUES</td>
                <td className="text-end fw-bold">{fmt(data.total_revenues)}</td>
              </tr>
            </tbody>
            {(data.revenues || []).map((row) => (
              <tbody key={row.account_code}>
                <tr>
                  <td className={`ps-3 ${hasFilter ? 'fw-semibold' : ''}`}>{row.account_name}</td>
                  <td className={`text-end ${hasFilter ? 'fw-semibold' : ''}`}>{fmt(row.amount)}</td>
                </tr>
                <DriverBreakdown details={row.details} />
              </tbody>
            ))}

            <tbody>
              <tr><td colSpan={2} className="py-2" /></tr>
            </tbody>

            <tbody>
              <tr className="table-warning">
                <td className="fw-bold">TOTAL EXPENSES</td>
                <td className="text-end fw-bold">{fmt(data.total_expenses)}</td>
              </tr>
            </tbody>
            {(data.expenses || []).map((row) => (
              <tbody key={row.account_code}>
                <tr>
                  <td className={`ps-3 ${hasFilter ? 'fw-semibold' : ''}`}>{row.account_name}</td>
                  <td className={`text-end ${hasFilter ? 'fw-semibold' : ''}`}>{fmt(row.amount)}</td>
                </tr>
                <DriverBreakdown details={row.details} />
              </tbody>
            ))}

            <tbody>
              <tr><td colSpan={2} className="py-2" /></tr>
            </tbody>

            <tbody>
              <tr className={`fw-bold ${data.net_profit >= 0 ? 'table-success' : 'table-danger'}`}>
                <td>NET PROFIT</td>
                <td className="text-end">{fmt(data.net_profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
