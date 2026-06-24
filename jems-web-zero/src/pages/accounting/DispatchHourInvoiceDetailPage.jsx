import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hourInvoicesService, INVOICE_STATUS } from '../../services/dispatch';
import { SectionCard, Field, Money } from '../../components/DetailSection';

function StatusBadge({ status }) {
  const s = INVOICE_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

export default function DispatchHourInvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [amount, setAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      hourInvoicesService.get(id),
      hourInvoicesService.amount(id),
    ]).then(([{ data: inv }, { data: amt }]) => {
      setInvoice(inv);
      setAmount(amt.amount);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const toggleStatus = async () => {
    if (!invoice) return;
    const isOpen = invoice.status === 1;
    if (!window.confirm(`${isOpen ? 'Close' : 'Reopen'} invoice #${invoice.number}?`)) return;
    setActioning(true);
    try {
      if (isOpen) await hourInvoicesService.close(id);
      else await hourInvoicesService.open(id);
      load();
    } finally {
      setActioning(false);
    }
  };

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!invoice) return <div className="alert alert-danger">Invoice not found.</div>;

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link to="/accounting/invoices/dispatchers-hour" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left" />
        </Link>
        <h5 className="mb-0">
          <i className="bi bi-clock me-2" />Hour Invoice #{invoice.number}
        </h5>
        <StatusBadge status={invoice.status} />
        <div className="ms-auto d-flex gap-2">
          <Link
            to={`/accounting/invoices/dispatchers-hour/${id}/edit`}
            className="btn btn-sm btn-outline-secondary"
          >
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={toggleStatus}
            disabled={actioning}
          >
            <i className={`bi bi-${invoice.status === 1 ? 'lock' : 'unlock'} me-1`} />
            {invoice.status === 1 ? 'Close' : 'Reopen'}
          </button>
        </div>
      </div>

      <SectionCard title="Invoice Details" icon="bi-file-earmark-text">
        <Field label="Invoice #">{invoice.number}</Field>
        <Field label="Dispatcher">{invoice.dispatcher_name || '—'}</Field>
        <Field label="Invoice Date">{invoice.date}</Field>
        <Field label="Period Start">{invoice.start ? invoice.start.replace('T', ' ').slice(0, 16) : '—'}</Field>
        <Field label="Period End">{invoice.end ? invoice.end.replace('T', ' ').slice(0, 16) : '—'}</Field>
        <Field label="Rate per Hour">
          {invoice.pay_per_hour != null ? `$${Number(invoice.pay_per_hour).toFixed(2)}/h` : '—'}
        </Field>
        <Field label="Status"><StatusBadge status={invoice.status} /></Field>
        <Field label="Computed Amount"><Money value={amount} /></Field>
        <Field label="Linked Record">{invoice.record || <span className="text-muted">—</span>}</Field>
        <Field label="Created">{invoice.created_at ? invoice.created_at.slice(0, 10) : '—'}</Field>
      </SectionCard>
    </div>
  );
}
