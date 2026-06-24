import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { USER_STATUS, usersService } from '../../services/users';
import { useUsers } from '../../hooks/useUsers';

function StatusBadge({ status }) {
  const s = USER_STATUS[status] || { label: String(status), cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

export default function UsersPage() {
  const { items, loading, reload } = useUsers({ all: 1 });
  const [q, setQ] = useState('');
  const [actioning, setActioning] = useState(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((u) => (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term)
      || String(u.username || '').toLowerCase().includes(term)
      || String(u.email || '').toLowerCase().includes(term)
    ));
  }, [items, q]);

  const toggle = async (user) => {
    if (!window.confirm(`Toggle status for ${user.full_name || user.username}?`)) return;
    setActioning(user.id);
    try {
      await usersService.toggleStatus(user.id);
      reload();
    } finally {
      setActioning(null);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Users</h4>
        <Link to="/settings/users/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />Create User
        </Link>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-6">
              <label className="form-label mb-1 small">Search</label>
              <input
                className="form-control form-control-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, username, or email"
              />
            </div>
            <div className="col-md-6 text-end">
              <span className="text-muted small">{filtered.length.toLocaleString()} users</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Dispatcher</th>
                <th>Contract</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted py-4">No users found.</td></tr>
              ) : filtered.map((user) => (
                <tr key={user.id}>
                  <td className="align-middle">
                    <Link to={`/settings/users/${user.id}`} className="text-decoration-none fw-semibold">
                      {user.full_name || `${user.first_name} ${user.last_name}`}
                    </Link>
                  </td>
                  <td className="align-middle">{user.username}</td>
                  <td className="align-middle">{user.email}</td>
                  <td className="align-middle">{user.is_dispatcher ? (user.dispatcher_type_display || 'Yes') : <span className="text-muted">—</span>}</td>
                  <td className="align-middle">{user.contract_display || <span className="text-muted">—</span>}</td>
                  <td className="align-middle text-center"><StatusBadge status={user.status} /></td>
                  <td className="align-middle text-center">
                    <div className="d-flex gap-1 justify-content-center">
                      <Link to={`/settings/users/${user.id}`} className="btn btn-sm btn-outline-primary py-0" title="View">
                        <i className="bi bi-eye" />
                      </Link>
                      <Link to={`/settings/users/${user.id}/edit`} className="btn btn-sm btn-outline-secondary py-0" title="Edit">
                        <i className="bi bi-pencil" />
                      </Link>
                      <button className="btn btn-sm btn-outline-warning py-0" onClick={() => toggle(user)} disabled={actioning === user.id} title="Toggle status">
                        <i className="bi bi-toggle-on" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
