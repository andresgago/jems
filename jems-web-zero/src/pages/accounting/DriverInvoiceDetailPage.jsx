import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDriverInvoice } from '../../hooks/useDriverInvoice';
import { driverInvoicesService, DRIVER_INVOICE_STATUS } from '../../services/accounting';

const AGREEMENT_TYPE = { 0: 'By percent', 1: 'By miles', 2: 'By contract' };

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoney(n) {
  return `$ ${fmt(n)}`;
}

function LoadNumbers({ loadList }) {
  if (!loadList) return <span className="text-muted">—</span>;
  return loadList
    .replace(/\|/g, ' / ')
    .replace(/,/g, ' / ');
}

function DetailedLoadsTable({ loads }) {
  if (!loads || loads.length === 0) return null;
  const total = loads.reduce((s, l) => s + (l.payment || 0), 0);
  return (
    <table className="table table-bordered table-sm mb-0" style={{ fontSize: '0.85rem' }}>
      <thead className="table-light">
        <tr>
          <th style={{ width: 40 }}>No.</th>
          <th>Order</th>
          <th>Pick up City / Date</th>
          <th>Drop off City / Date</th>
          <th className="text-end">Rate</th>
        </tr>
      </thead>
      <tbody>
        {loads.map((load, i) => (
          <tr key={load.id}>
            <td>{i + 1}</td>
            <td>
              <Link to={`/loads/${load.id}`} className="text-decoration-none">
                {load.number}
              </Link>
            </td>
            <td>
              {load.pickup_city}<br />
              <small className="text-muted">{load.pickup_date}</small>
            </td>
            <td>
              {load.dropoff_city}<br />
              <small className="text-muted">{load.dropoff_date}</small>
            </td>
            <td className="text-end">{fmtMoney(load.payment)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="table-light fw-bold">
          <td colSpan={4} className="text-end">Total Gross</td>
          <td className="text-end">{fmtMoney(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function InvoiceBreakdownTable({ records, percent }) {
  if (!records || records.length === 0) return null;

  const incomes = records.filter((r) => r.record_type === 1);
  const expenses = records.filter((r) => r.record_type === 2);
  const totalIncome = incomes.reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpense = expenses.reduce((s, r) => s + (r.amount || 0), 0);
  const subtotal = totalIncome - totalExpense;
  const pct = Number(percent || 0) / 100;
  const driverTotal = subtotal * pct;
  const pctLabel = percent > 0 ? `${percent}% Driver` : 'Driver';

  return (
    <table className="table table-bordered table-sm mb-0" style={{ fontSize: '0.85rem' }}>
      <thead className="table-light">
        <tr>
          <th style={{ width: 40 }}>No.</th>
          <th>Details</th>
          <th className="text-end">Amount</th>
          <th className="text-end">{pctLabel}</th>
        </tr>
      </thead>
      <tbody>
        {incomes.length > 0 && (
          <tr>
            <td colSpan={4} className="fw-semibold bg-light">Incomes</td>
          </tr>
        )}
        {incomes.map((r, i) => (
          <tr key={r.id}>
            <td>{i + 1}</td>
            <td>{r.account_name}</td>
            <td className="text-end">{fmtMoney(r.amount)}</td>
            <td className="text-end">{fmtMoney(r.amount * pct)}</td>
          </tr>
        ))}
        {expenses.length > 0 && (
          <tr>
            <td colSpan={4} className="fw-semibold bg-light">Expenses</td>
          </tr>
        )}
        {expenses.map((r, i) => (
          <tr key={r.id}>
            <td>{incomes.length + i + 1}</td>
            <td>{r.account_name}</td>
            <td className="text-end text-danger">$ -{fmt(r.amount)}</td>
            <td className="text-end text-danger">$ -{fmt(r.amount * pct)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="table-light">
          <td colSpan={3} className="text-end fw-semibold">Subtotal</td>
          <td className="text-end fw-semibold">{fmtMoney(driverTotal)}</td>
        </tr>
        <tr className="table-light fw-bold">
          <td colSpan={3} className="text-end">Driver Total</td>
          <td className="text-end">{fmtMoney(driverTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function DriverInvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoice, loading, error, refresh } = useDriverInvoice(id);
  const [actioning, setActioning] = useState(false);
  const printRef = useRef(null);

  const handleToggle = async () => {
    const isOpen = invoice.status === 1;
    const label = isOpen ? 'Close' : 'Reopen';
    if (!window.confirm(`${label} invoice #${invoice.number}?`)) return;
    setActioning(true);
    try {
      if (isOpen) {
        await driverInvoicesService.close(id);
      } else {
        await driverInvoicesService.open(id);
      }
      refresh();
    } finally {
      setActioning(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete driver invoice #${invoice.number}?`)) return;
    await driverInvoicesService.destroy(id);
    navigate('/accounting/invoices/drivers');
  };

  const handlePrint = () => window.print();

  if (loading) return <p className="text-muted">Loading…</p>;
  if (error || !invoice) return <div className="alert alert-danger">Invoice not found.</div>;

  const statusInfo = DRIVER_INVOICE_STATUS[invoice.status] || { label: invoice.status, cls: 'secondary' };
  const isOpen = invoice.status === 1;
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  return (
    <div>
      {/* Toolbar — hidden when printing */}
      <div className="d-flex justify-content-between align-items-center mb-3 d-print-none">
        <h5 className="mb-0">
          <i className="bi bi-file-earmark-text me-2" />
          Driver Invoice #{invoice.number}
          <span className={`badge bg-${statusInfo.cls} ms-2`}>{statusInfo.label}</span>
        </h5>
        <div className="d-flex gap-2">
          <Link to="/accounting/invoices/drivers" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1" />Back
          </Link>
          <button className="btn btn-sm btn-outline-secondary" onClick={handlePrint}>
            <i className="bi bi-printer me-1" />Print
          </button>
          <button
            className={`btn btn-sm btn-outline-${isOpen ? 'warning' : 'success'}`}
            disabled={actioning}
            onClick={handleToggle}
          >
            <i className={`bi bi-${isOpen ? 'lock' : 'unlock'} me-1`} />
            {isOpen ? 'Close Invoice' : 'Reopen Invoice'}
          </button>
          <button className="btn btn-outline-danger btn-sm" onClick={handleDelete}>
            <i className="bi bi-trash me-1" />Delete
          </button>
        </div>
      </div>

      {/* Pay agreement document */}
      <div ref={printRef} style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Document header */}
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div>
            <div className="fw-bold fs-5">JE-DRI {invoice.number}</div>
            {invoice.carrier_name && <div className="small">{invoice.carrier_name}</div>}
            {invoice.carrier_mc && <div className="small">MC# {invoice.carrier_mc}</div>}
          </div>
          <div className="text-end small text-muted">Date: {today}</div>
        </div>

        <h4 className="text-center my-3">Driver pay agreement</h4>

        {/* Driver + agreement summary */}
        <table className="table table-bordered table-sm mb-3" style={{ fontSize: '0.85rem' }}>
          <tbody>
            <tr>
              <td colSpan={2} className="fw-semibold text-center bg-light">
                Driver: {invoice.driver_name}
              </td>
            </tr>
            <tr>
              <td>Agreement: <strong>{AGREEMENT_TYPE[invoice.invoice_type] ?? invoice.invoice_type}</strong></td>
              <td className="text-end">
                Pay the following loads:{' '}
                <LoadNumbers loadList={invoice.load_list} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Detailed loads */}
        {invoice.loads && invoice.loads.length > 0 && (
          <div className="mb-3">
            <div className="fw-semibold bg-light border px-2 py-1 mb-0" style={{ fontSize: '0.85rem' }}>
              Detailed loads
            </div>
            <DetailedLoadsTable loads={invoice.loads} />
          </div>
        )}

        {/* Invoice breakdown */}
        {invoice.records && invoice.records.length > 0 && (
          <div className="mb-3">
            <div className="fw-semibold bg-light border px-2 py-1 mb-0" style={{ fontSize: '0.85rem' }}>
              Invoice
            </div>
            <InvoiceBreakdownTable records={invoice.records} percent={invoice.percent} />
          </div>
        )}

        {invoice.vacation_pay && (
          <div className="alert alert-info py-2 small d-print-none">
            Vacation pay included
          </div>
        )}
      </div>
    </div>
  );
}
