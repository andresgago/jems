import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { authService } from '../services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(null);

  useEffect(() => {
    authService.getVersion().then((res) => setVersion(res.data.version)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex flex-column"
      style={{ background: 'linear-gradient(to bottom, #46627f, #34495e)' }}
    >
      <div className="flex-grow-1 d-flex align-items-center justify-content-center py-5">
        <div style={{ width: '380px' }}>
          <div className="text-center mb-3">
            <img src="/logow.png" alt="Jobee Express" height="90" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div className="login-card shadow">
            <h5 className="mb-3 text-center">Sign in</h5>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                Login
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="text-center pb-4" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.75)' }}>
          Jobee Express Management System{version ? ` v${version}` : ''}
        </span>
        <br />
        <strong style={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.85rem', letterSpacing: '0.03em' }}>
          Jobee Express LLC
        </strong>
        <br />
        Copyright &copy; 2019 &ndash; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
