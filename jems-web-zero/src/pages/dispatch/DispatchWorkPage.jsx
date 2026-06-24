import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatchWork } from '../../hooks/useDispatchWork';
import { dispatchWorkService } from '../../services/dispatch';
import { useAuth } from '../../contexts/useAuth';

function formatDuration(hours) {
  if (!hours) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function WorkRow({ session, onChanged }) {
  const [actioning, setActioning] = useState(false);

  const doFinish = async () => {
    if (!window.confirm('Mark this session as finished?')) return;
    setActioning(true);
    try {
      await dispatchWorkService.finish(session.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  const doMarkPaid = async () => {
    if (!window.confirm('Mark this session as paid?')) return;
    setActioning(true);
    try {
      await dispatchWorkService.markPaid(session.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr>
      <td className="align-middle">{session.dispatcher_name || <span className="text-muted">—</span>}</td>
      <td className="align-middle">{session.title}</td>
      <td className="align-middle">{session.start ? session.start.replace('T', ' ').slice(0, 16) : '—'}</td>
      <td className="align-middle">{session.end ? session.end.replace('T', ' ').slice(0, 16) : '—'}</td>
      <td className="align-middle text-center">{formatDuration(session.duration_hours)}</td>
      <td className="align-middle text-center">
        {session.is_finished
          ? <span className="badge bg-success">Done</span>
          : <span className="badge bg-warning text-dark">In Progress</span>}
      </td>
      <td className="align-middle text-center">
        {session.is_paid
          ? <span className="badge bg-success">Paid</span>
          : <span className="badge bg-secondary">Unpaid</span>}
      </td>
      <td className="align-middle text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/dispatch/work/${session.id}/edit`}
            className="btn btn-sm btn-outline-secondary py-0"
            title="Edit"
          >
            <i className="bi bi-pencil" />
          </Link>
          {!session.is_finished && (
            <button
              className="btn btn-sm btn-outline-success py-0"
              title="Finish"
              disabled={actioning}
              onClick={doFinish}
            >
              <i className="bi bi-check-lg" />
            </button>
          )}
          {!session.is_paid && (
            <button
              className="btn btn-sm btn-outline-primary py-0"
              title="Mark Paid"
              disabled={actioning}
              onClick={doMarkPaid}
            >
              <i className="bi bi-currency-dollar" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function DispatchWorkPage({ selfOnly = false }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [finishedFilter, setFinishedFilter] = useState('');

  const params = {};
  if (selfOnly && user?.user_id) params.dispatcher = user.user_id;
  if (finishedFilter !== '') params.is_finished = finishedFilter;

  const { items, loading, error, reload } = useDispatchWork(params);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        (s.dispatcher_name || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const title = selfOnly ? 'My Work Sessions' : 'Dispatchers Calendar';
  const icon = selfOnly ? 'bi-person-badge' : 'bi-calendar3';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0"><i className={`bi ${icon} me-2`} />{title}</h5>
        <Link to="/dispatch/work/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />New Session
        </Link>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          className="form-control form-control-sm w-auto"
          placeholder="Search dispatcher or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-select form-select-sm w-auto"
          value={finishedFilter}
          onChange={(e) => { setFinishedFilter(e.target.value); reload(); }}
        >
          <option value="">All</option>
          <option value="true">Finished</option>
          <option value="false">In Progress</option>
        </select>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <div className="alert alert-danger">Failed to load work sessions.</div>}

      {!loading && !error && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0">
              <thead className="table-light">
                <tr>
                  <th>Dispatcher</th>
                  <th>Title</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="text-center">Duration</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Paid</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">No work sessions found.</td>
                  </tr>
                )}
                {filtered.map((s) => (
                  <WorkRow key={s.id} session={s} onChanged={reload} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-muted small">
            {filtered.length} session{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
