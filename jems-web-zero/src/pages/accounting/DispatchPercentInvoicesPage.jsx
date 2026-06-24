import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePercentInvoices } from '../../hooks/usePercentInvoices';
import { percentInvoicesService, INVOICE_STATUS } from '../../services/dispatch';

function StatusBadge({ status }) {
  const s = INVOICE_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function InvoiceRow({ invoice, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const toggleStatus = async () => {
    const isOpen = invoice.status === 1;
    if (!window.confirm(`${isOpen ? 'Close' : 'Reopen'} invoice #${invoice.number}?`)) return;
    setActioning(true);
    try {
      if (isOpen) await percentInvoicesService.close(invoice.id);
      else await percentInvoicesService.open(invoice.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr>
      <td className="align-middle fw-semibold">
        <Link to={`/accounting/invoices/dispatchers-percent/${invoice.id}`} className="text-decoration-none">
          #{invoice.number}
        </Link>
      </td>
      <td className="align-middle">{invoice.dispatcher_name || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{invoice.date}</td>
      <td className="align-middle text-center">{invoice.percent != null ? `${invoice.percent}%` : '—'}</td>
      <td className="align-middle text-center"><StatusBadge status={invoice.status} /></td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/accounting/invoices/dispatchers-percent/${invoice.id}`}
            className="btn btn-sm btn-outline-primary py-0"
            title="View"
          >
            <i className="bi bi-eye" />
          </Link>
          <button
            className="btn btn-sm btn-outline-dark py-0"
            title={invoice.status === 1 ? 'Close' : 'Reopen'}
            disabled={actioning}
            onClick={toggleStatus}
          >
            <i className={`bi bi-${invoice.status === 1 ? 'lock' : 'unlock'}`} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DispatchPercentInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const params = statusFilter !== '' ? { status: statusFilter } : {};
  const { items, loading, error, reload } = usePercentInvoices(params);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (inv) =>
        String(inv.number).includes(q) ||
        (inv.dispatcher_name || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-percent me-2" />Dispatcher Invoices — By Percent</h5>
        <Link to="/accounting/invoices/dispatchers-percent/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />New Invoice
        </Link>
      </div>

      <div className="d-flex gap-2 mb-3">
        <input
          type="text"
          className="form-control form-control-sm w-auto"
          placeholder="Search by # or dispatcher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select form-select-sm w-auto"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); reload(); }}
        >
          <option value="">All Statuses</option>
          <option value="1">Open</option>
          <option value="0">Closed</option>
        </select>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <div className="alert alert-danger">Failed to load invoices.</div>}

      {!loading && !error && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0">
              <thead className="table-light">
                <tr>
                  <th>Invoice #</th>
                  <th>Dispatcher</th>
                  <th>Date</th>
                  <th className="text-center">Percent</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">No invoices found.</td>
                  </tr>
                )}
                {filtered.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} onChanged={reload} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted small">
            {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
