import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRecord } from '../../hooks/useRecord';
import { recordsService, RECORD_TYPE } from '../../services/accounting';
import { SectionCard, Field } from '../../components/DetailSection';

export default function RecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { record, loading, error } = useRecord(id);

  const handleDelete = async () => {
    if (!window.confirm('Delete this record permanently?')) return;
    await recordsService.destroy(id);
    navigate('/accounting/records');
  };

  if (loading) return <p className="text-muted">Loading…</p>;
  if (error || !record) return <div className="alert alert-danger">Record not found.</div>;

  const typeInfo = RECORD_TYPE[record.record_type] || { label: record.record_type, cls: 'secondary' };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-journal-text me-2" />
          Record #{record.id}
        </h5>
        <div className="d-flex gap-2">
          <Link to="/accounting/records" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1" />Back
          </Link>
          <Link to={`/accounting/records/${id}/edit`} className="btn btn-outline-primary btn-sm">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button className="btn btn-outline-danger btn-sm" onClick={handleDelete}>
            <i className="bi bi-trash me-1" />Delete
          </button>
        </div>
      </div>

      <SectionCard title="General" icon="bi-info-circle">
        <Field label="Date">{record.date}</Field>
        <Field label="Account">
          {record.account_code
            ? <span className="font-monospace">{record.account_code}</span>
            : <span className="text-muted">—</span>}
          {record.account_name && <span className="text-muted ms-2 small">— {record.account_name}</span>}
        </Field>
        <Field label="Amount">
          <span className={record.amount < 0 ? 'text-danger fw-semibold' : 'text-success fw-semibold'}>
            ${Math.abs(record.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            {record.amount < 0 ? ' (debit)' : ' (credit)'}
          </span>
        </Field>
        <Field label="Quantity">{record.quantity ?? '—'}</Field>
        <Field label="Type">
          <span className={`badge bg-${typeInfo.cls}`}>{typeInfo.label}</span>
        </Field>
        <Field label="Detail">{record.detail || <span className="text-muted">—</span>}</Field>
        <Field label="Product">{record.product || <span className="text-muted">—</span>}</Field>
        <Field label="Transaction #">{record.transaction_number || <span className="text-muted">—</span>}</Field>
      </SectionCard>

      <SectionCard title="Linked Entities" icon="bi-link-45deg">
        <Field label="Load">{record.load ?? <span className="text-muted">—</span>}</Field>
        <Field label="Truck">{record.truck ?? <span className="text-muted">—</span>}</Field>
        <Field label="Trailer">{record.trailer ?? <span className="text-muted">—</span>}</Field>
        <Field label="Driver">{record.driver ?? <span className="text-muted">—</span>}</Field>
        <Field label="Team Driver">{record.team_driver ?? <span className="text-muted">—</span>}</Field>
        <Field label="Owner">{record.owner ?? <span className="text-muted">—</span>}</Field>
        <Field label="Dispatcher">{record.dispatcher ?? <span className="text-muted">—</span>}</Field>
        <Field label="City">{record.city ?? <span className="text-muted">—</span>}</Field>
        <Field label="Card">{record.card ?? <span className="text-muted">—</span>}</Field>
        <Field label="Carrier">{record.carrier ?? <span className="text-muted">—</span>}</Field>
      </SectionCard>

      <SectionCard title="Category" icon="bi-tag">
        <Field label="Category">{record.category ?? <span className="text-muted">—</span>}</Field>
        <Field label="Category Expires">
          {record.category_expire
            ? <span className="badge bg-warning text-dark">Yes</span>
            : <span className="text-muted">No</span>}
        </Field>
        <Field label="Category Expiry Date">
          {record.category_expire_date || <span className="text-muted">—</span>}
        </Field>
      </SectionCard>

      <SectionCard title="System" icon="bi-gear">
        <Field label="Auto-created">
          {record.is_automatic
            ? <span className="badge bg-info">Yes</span>
            : <span className="text-muted">No</span>}
        </Field>
        <Field label="Progress">{record.progress}</Field>
        <Field label="Created At">{record.created_at?.slice(0, 19).replace('T', ' ')}</Field>
        <Field label="Updated At">{record.updated_at?.slice(0, 19).replace('T', ' ')}</Field>
      </SectionCard>
    </div>
  );
}
