import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  return (
    <div className="row">
      <div className="col-12">
        <h4>Welcome, {user?.full_name || user?.username}</h4>
        <p className="text-muted">Select an option from the menu to get started.</p>
      </div>
    </div>
  );
}
