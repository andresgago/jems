import { useEffect, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import api from '../../services/api';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const today = new Date();
const defaultEnd = formatDate(today);
const defaultStart = formatDate(addDays(today, -7));

function selectedValues(event) {
  return Array.from(event.target.selectedOptions, (option) => Number(option.value));
}

function driverLabel(driver) {
  const carrier = driver.carrier_name ? ` (${driver.carrier_name})` : '';
  const status = driver.status === 1 ? '' : ' [off]';
  return `${driver.full_name}${carrier}${status}`;
}

function invoiceLabel(invoice) {
  const prefix = String(invoice.number).startsWith('JE-DRI') ? '' : 'JE-DRI ';
  const driver = invoice.driver_name ? ` - ${invoice.driver_name}` : '';
  return `${prefix}${invoice.number}${driver}`;
}

export default function InvoiceReportPage() {
  const [carrier, setCarrier] = useState('');
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [selDrivers, setSelDrivers] = useState([]);
  const [selInvoices, setSelInvoices] = useState([]);
  const [carrierOptions, setCarrierOptions] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const [invoiceOptions, setInvoiceOptions] = useState([]);

  useEffect(() => {
    api.get('/carriers/options/').then((r) => setCarrierOptions(r.data)).catch(() => {});
    api.get('/drivers/options/').then((r) => setDriverOptions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = { date_begin: start, date_end: end };
    if (carrier) params.carrier = carrier;
    if (selDrivers.length) params.driver = selDrivers.join(',');
    api.get('/accounting/driver-invoices/options/', { params })
      .then((r) => setInvoiceOptions(r.data))
      .catch(() => setInvoiceOptions([]));
    setSelInvoices([]);
  }, [carrier, start, end, selDrivers]);

  function handleShowReport() {
    const params = new URLSearchParams();
    params.set('date_begin', start);
    params.set('date_end', end);
    if (carrier) params.set('carrier', carrier);
    selDrivers.forEach((id) => params.append('driver', id));
    selInvoices.forEach((id) => params.append('invoice', id));
    window.open(`/print/invoice?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Profit and Loss By Invoices</h5>

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label htmlFor="filter-carrier" className="fw-semibold small mb-1 d-block">Carrier</label>
          <select
            id="filter-carrier"
            className="form-select"
            style={{ height: '48px' }}
            value={carrier}
            onChange={(e) => {
              setCarrier(e.target.value);
              setSelDrivers([]);
              setSelInvoices([]);
            }}
          >
            <option value="">Select a carrier</option>
            {carrierOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="col-md-3">
          <label className="fw-semibold small mb-1 d-block">Filter by Dates</label>
          <DateRangePicker
            start={start}
            end={end}
            onApply={({ start: s, end: e }) => {
              setStart(s);
              setEnd(e);
            }}
          />
        </div>

        <div className="col-md-3">
          <label htmlFor="filter-drivers" className="fw-semibold small mb-1 d-block">Select Driver</label>
          <select
            id="filter-drivers"
            className="form-select"
            multiple
            size={1}
            value={selDrivers.map(String)}
            onChange={(e) => setSelDrivers(selectedValues(e))}
            style={{ height: '48px' }}
          >
            {driverOptions.map((d) => (
              <option key={d.id} value={d.id}>{driverLabel(d)}</option>
            ))}
          </select>
        </div>

        <div className="col-md-3" />
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <label htmlFor="filter-invoices" className="fw-semibold small mb-1 d-block">Select Invoice</label>
          <select
            id="filter-invoices"
            className="form-select"
            multiple
            size={1}
            value={selInvoices.map(String)}
            onChange={(e) => setSelInvoices(selectedValues(e))}
            style={{ minHeight: '48px' }}
          >
            {invoiceOptions.map((i) => (
              <option key={i.id} value={i.id}>{invoiceLabel(i)}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn btn-success" onClick={handleShowReport}>
        Show Report
      </button>
    </div>
  );
}
