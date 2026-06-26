import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useDashboard } from '../hooks/useDashboard';

const TABS = [
  { key: 'drivers', label: 'Drivers', countKey: 'drivers_expiring' },
  { key: 'trucks', label: 'Trucks', countKey: 'trucks_expiring' },
  { key: 'trailers', label: 'Trailers', countKey: 'trailers_expiring' },
];

function AlertIcon({ expired }) {
  if (expired) {
    return <i className="bi bi-exclamation-circle-fill text-danger me-1" />;
  }
  return <i className="bi bi-exclamation-triangle-fill text-warning me-1" />;
}

function AlertRow({ entity, entityPath }) {
  return (
    <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
      <div className="d-flex align-items-center gap-2">
        <i className="bi bi-person-circle text-danger fs-3" />
        <div>
          <div className="fw-semibold">
            <Link to={entityPath}>{entity.name}</Link>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {entity.alerts.map((alert) => (
              <span key={alert.type} className="d-flex align-items-center small">
                <AlertIcon expired={alert.expired} />
                <span className={alert.expired ? 'text-danger' : 'text-warning'}>
                  {alert.label}
                </span>
                <span className="text-muted ms-1">
                  {alert.expired
                    ? `(expired ${Math.abs(alert.days_until)}d ago)`
                    : `(${alert.days_until}d)`}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <Link to={entityPath} className="btn btn-sm btn-teal ms-2">
        <i className="bi bi-arrow-right-circle" />
      </Link>
    </div>
  );
}

function AlertList({ entities, buildPath }) {
  if (!entities || entities.length === 0) {
    return <p className="text-muted mt-3">No expiration alerts.</p>;
  }
  return (
    <div>
      {entities.map((entity) => (
        <AlertRow key={entity.id} entity={entity} entityPath={buildPath(entity.id)} />
      ))}
    </div>
  );
}

function StatCard({ label, value, bg, pct }) {
  return (
    <div className={`card text-white ${bg} mb-3`}>
      <div className="card-body">
        <div className="small text-uppercase fw-semibold mb-1 opacity-75">{label}</div>
        <div className="display-6 fw-bold">{value ?? '—'}</div>
        {pct != null && (
          <>
            <div className="progress mt-2" style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.3)' }}>
              <div
                className="progress-bar bg-white"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="small mt-1 opacity-75">{pct}% of executed Loads</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { data, loading } = useDashboard();
  const [activeTab, setActiveTab] = useState('drivers');

  const counts = data?.counts ?? {};
  const alerts = data?.expiration_alerts ?? {};
  const stats = data?.stats ?? {};

  const invoicedPct =
    stats.executed_loads > 0
      ? Math.round((stats.invoiced / stats.executed_loads) * 100)
      : null;

  function renderTabContent() {
    if (activeTab === 'drivers') {
      return (
        <AlertList
          entities={alerts.drivers}
          buildPath={(id) => `/drivers/${id}`}
        />
      );
    }
    if (activeTab === 'trucks') {
      return (
        <AlertList
          entities={alerts.trucks}
          buildPath={(id) => `/fleet/trucks/${id}`}
        />
      );
    }
    if (activeTab === 'trailers') {
      return (
        <AlertList
          entities={alerts.trailers}
          buildPath={(id) => `/fleet/trailers/${id}`}
        />
      );
    }
    return null;
  }

  return (
    <div>
      <h5 className="mb-3">
        Welcome, {user?.full_name || user?.username}
      </h5>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {!loading && (
        <div className="row">
          {/* Left column: expiration alert tabs */}
          <div className="col-lg-9">
            <div className="card">
              <div className="card-header p-0">
                <ul className="nav nav-tabs border-0">
                  {TABS.map((tab) => (
                    <li key={tab.key} className="nav-item">
                      <button
                        type="button"
                        className={`nav-link${activeTab === tab.key ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {tab.label}
                        {counts[tab.countKey] > 0 && (
                          <span className="badge bg-danger ms-1">
                            {counts[tab.countKey]}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  <li className="nav-item ms-auto d-flex align-items-center pe-2">
                    <Link to="/dispatch/my-calendar" className="nav-link">
                      <i className="bi bi-calendar3 me-1" />
                      My work Calendar
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="card-body">
                {renderTabContent()}
              </div>
            </div>
          </div>

          {/* Right column: stat cards */}
          <div className="col-lg-3">
            <StatCard
              label="In Dispatch"
              value={stats.loads_in_dispatch}
              bg="bg-primary"
            />
            <StatCard
              label="Executed"
              value={stats.executed_loads}
              bg="bg-success"
            />
            <StatCard
              label="Invoiced"
              value={stats.invoiced}
              bg="bg-info"
              pct={invoicedPct}
            />
          </div>
        </div>
      )}
    </div>
  );
}
