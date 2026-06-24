import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecords } from '../../hooks/useRecords';
import { recordsService, RECORD_TYPE } from '../../services/accounting';

function TypeBadge({ value }) {
  const t = RECORD_TYPE[value] || { label: value, cls: 'secondary' };
  return <span className={`badge bg-${t.cls}`}>{t.label}</span>;
}

function RecordRow({ record, onChanged }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Delete this record?')) return;
    setDeleting(true);
    try {
      await recordsService.destroy(record.id);
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr>
      <td className="align-middle">{record.date}</td>
      <td className="align-middle font-monospace small">
        {record.account_code || <span className="text-muted">—</span>}
      </td>
      <td className="align-middle">
        <span className={record.amount < 0 ? 'text-danger' : 'text-success'}>
          ${Math.abs(record.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </td>
      <td className="align-middle small">
        {record.detail ? (
          <span className="text-truncate d-inline-block" style={{ maxWidth: 200 }}>
            {record.detail}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="align-middle"><TypeBadge value={record.record_type} /></td>
      <td className="align-middle text-muted small">{record.load || '—'}</td>
      <td className="align-middle">
        <div className="d-flex gap-1 justify-content-center">
          <Link to={`/accounting/records/${record.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/accounting/records/${record.id}/edit`} className="btn btn-sm btn-outline-secondary py-0" title="Edit">
            <i className="bi bi-pencil" />
          </Link>
          <button
            className="btn btn-sm btn-outline-danger py-0"
            title="Delete"
            disabled={deleting}
            onClick={handleDelete}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function RecordsPage() {
  const [filters, setFilters] = useState({ date_from: '', date_to: '', account: '', driver: '' });
  const [applied, setApplied] = useState({});
  const { records, loading, error, refresh } = useRecords(applied);

  const apply = (e) => {
    e.preventDefault();
    const params = {};
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.account) params.account = filters.account;
    if (filters.driver) params.driver = filters.driver;
    setApplied(params);
  };

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className="bi bi-journal-text me-2" />Accounting Records</h5>
        <Link to="/accounting/records/create" className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1" />New Record
        </Link>
      </div>

      <form className="card mb-3" onSubmit={apply}>
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label small mb-1">Date from</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.date_from}
                onChange={(e) => set('date_from', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Date to</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.date_to}
                onChange={(e) => set('date_to', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Account ID</label>
              <input
                type="number"
                className="form-control form-control-sm"
                placeholder="ID"
                value={filters.account}
                onChange={(e) => set('account', e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Driver ID</label>
              <input
                type="number"
                className="form-control form-control-sm"
                placeholder="ID"
                value={filters.driver}
                onChange={(e) => set('driver', e.target.value)}
              />
            </div>
            <div className="col-auto">
              <button type="submit" className="btn btn-outline-primary btn-sm">
                <i className="bi bi-search me-1" />Filter
              </button>
            </div>
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => { setFilters({ date_from: '', date_to: '', account: '', driver: '' }); setApplied({}); }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </form>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <div className="alert alert-danger">Failed to load records.</div>}

      {!loading && !error && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Amount</th>
                  <th>Detail</th>
                  <th>Type</th>
                  <th>Load</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">No records found.</td>
                  </tr>
                )}
                {records.map((r) => (
                  <RecordRow key={r.id} record={r} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted small">
            {records.length} record{records.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
