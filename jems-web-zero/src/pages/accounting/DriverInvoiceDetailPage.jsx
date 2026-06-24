import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDriverInvoice } from '../../hooks/useDriverInvoice';
import { driverInvoicesService, DRIVER_INVOICE_STATUS } from '../../services/accounting';
import { SectionCard, Field } from '../../components/DetailSection';

export default function DriverInvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoice, loading, error, refresh } = useDriverInvoice(id);
  const [actioning, setActioning] = useState(false);

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

  if (loading) return <p className="text-muted">Loading…</p>;
  if (error || !invoice) return <div className="alert alert-danger">Invoice not found.</div>;

  const statusInfo = DRIVER_INVOICE_STATUS[invoice.status] || { label: invoice.status, cls: 'secondary' };
  const isOpen = invoice.status === 1;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-file-earmark-text me-2" />
          Driver Invoice #{invoice.number}
          <span className={`badge bg-${statusInfo.cls} ms-2`}>{statusInfo.label}</span>
        </h5>
        <div className="d-flex gap-2">
          <Link to="/accounting/invoices/drivers" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1" />Back
          </Link>
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

      <SectionCard title="Invoice Details" icon="bi-file-earmark-text">
        <Field label="Invoice #">{invoice.number}</Field>
        <Field label="Driver">{invoice.driver_name || <span className="text-muted">—</span>}</Field>
        <Field label="Date">{invoice.date}</Field>
        <Field label="Status">
          <span className={`badge bg-${statusInfo.cls}`}>{statusInfo.label}</span>
        </Field>
        <Field label="Type">{invoice.invoice_type ?? <span className="text-muted">—</span>}</Field>
        <Field label="Contract">{invoice.contract ?? <span className="text-muted">—</span>}</Field>
        <Field label="Percent">{invoice.percent != null ? `${invoice.percent}%` : '—'}</Field>
        <Field label="Miles (Empty)">{invoice.miles_empty}</Field>
        <Field label="Miles (Full)">{invoice.miles_full}</Field>
        <Field label="Vacation Pay">
          {invoice.vacation_pay
            ? <span className="badge bg-info">Yes</span>
            : <span className="text-muted">No</span>}
        </Field>
        <Field label="Vacation Now">{invoice.vacation_now || <span className="text-muted">—</span>}</Field>
      </SectionCard>

      <SectionCard title="Load List" icon="bi-list-ul">
        <div className="col-12">
          {invoice.load_list
            ? <pre className="small mb-0 font-monospace">{invoice.load_list}</pre>
            : <span className="text-muted">No loads listed.</span>}
        </div>
      </SectionCard>

      <SectionCard title="System" icon="bi-gear">
        <Field label="Created At">{invoice.created_at?.slice(0, 19).replace('T', ' ')}</Field>
        <Field label="Updated At">{invoice.updated_at?.slice(0, 19).replace('T', ' ')}</Field>
      </SectionCard>
    </div>
  );
}
