import { Link, useParams } from 'react-router-dom';
import { Field, SectionCard, YesNo } from '../../components/DetailSection';
import { useUser } from '../../hooks/useUser';
import { USER_STATUS } from '../../services/users';
import { mediaUrl } from '../../utils/media';

function StatusBadge({ status }) {
  const s = USER_STATUS[status] || { label: String(status), cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

export default function UserDetailPage() {
  const { id } = useParams();
  const { item: user, loading, error } = useUser(id);

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (error || !user) {
    return <div className="alert alert-danger">User not found.</div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Link to="/settings/users" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1" />Users
          </Link>
          <h4 className="mb-0 mt-1">{user.full_name}</h4>
        </div>
        <Link to={`/settings/users/${user.id}/edit`} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-pencil me-1" />Edit
        </Link>
      </div>

      <SectionCard title="Profile" icon="bi-person">
        <Field label="Username">{user.username}</Field>
        <Field label="Email">{user.email}</Field>
        <Field label="Phone">{user.phone}</Field>
        <Field label="Status"><StatusBadge status={user.status} /></Field>
        <Field label="Address">{user.address}</Field>
        <Field label="Position">{user.position_name}</Field>
      </SectionCard>

      <SectionCard title="Dispatcher" icon="bi-calendar-week">
        <Field label="Dispatcher"><YesNo value={user.is_dispatcher} /></Field>
        <Field label="Type">{user.dispatcher_type_display}</Field>
        <Field label="Contract">{user.contract_display}</Field>
        <Field label="Main Dispatcher">{user.main_dispatcher_name}</Field>
        <Field label="Percent">{user.percent}</Field>
        <Field label="Hours">{user.hours}</Field>
        <Field label="Start Hour">{user.start_hour}</Field>
        <Field label="End Hour">{user.end_hour}</Field>
        <Field label="Color">
          {user.color ? <span className="badge" style={{ backgroundColor: user.color }}>{user.color}</span> : null}
        </Field>
      </SectionCard>

      <SectionCard title="Photo" icon="bi-image">
        <div className="col-12">
          {user.photo ? (
            <a href={mediaUrl(user.photo)} target="_blank" rel="noreferrer">Download photo</a>
          ) : <span className="text-muted">No photo uploaded.</span>}
        </div>
      </SectionCard>
    </div>
  );
}
