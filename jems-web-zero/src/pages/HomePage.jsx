import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useDashboard } from '../hooks/useDashboard';
import WorkCalendar from '../components/WorkCalendar';

// Tabs with their expiration-count key and optional maintenance-alert key
const TABS = [
  { key: 'drivers', label: 'Drivers', countKey: 'drivers_expiring' },
  {
    key: 'trucks',
    label: 'Trucks',
    countKey: 'trucks_expiring',
    maintenanceKey: 'trucks_maintenance_alerts',
  },
  {
    key: 'trailers',
    label: 'Trailers',
    countKey: 'trailers_expiring',
    maintenanceKey: 'trailers_maintenance_alerts',
  },
  { key: 'categories', label: 'Categories', countKey: 'categories_expiring' },
  { key: 'calendar', label: 'My work Calendar' },
];

function AlertIcon({ expired }) {
  if (expired) {
    return <i className="bi bi-exclamation-circle-fill text-danger me-1" />;
  }
  return <i className="bi bi-exclamation-triangle-fill text-warning me-1" />;
}

function EntityIcon({ tabKey }) {
  if (tabKey === 'drivers') {
    return <i className="bi bi-person-circle text-danger fs-3" />;
  }
  if (tabKey === 'trucks') {
    return <i className="bi bi-truck text-secondary fs-3" />;
  }
  if (tabKey === 'trailers') {
    return <i className="bi bi-box-seam text-secondary fs-3" />;
  }
  return <i className="bi bi-tag-fill text-secondary fs-3" />;
}

function AlertRow({ entity, entityPath, tabKey }) {
  return (
    <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
      <div className="d-flex align-items-center gap-2">
        <EntityIcon tabKey={tabKey} />
        <div>
          <div className="fw-semibold">
            {entityPath ? (
              <Link to={entityPath}>{entity.name}</Link>
            ) : (
              entity.name
            )}
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
                {alert.expires_on && (
                  <span className="text-muted ms-1">— {alert.expires_on}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
      {entityPath && (
        <Link to={entityPath} className="btn btn-sm btn-teal ms-2">
          <i className="bi bi-arrow-right-circle" />
        </Link>
      )}
    </div>
  );
}

function AlertList({ entities, buildPath, tabKey }) {
  if (!entities || entities.length === 0) {
    return <p className="text-muted mt-3 mb-0">No expiration alerts.</p>;
  }
  return (
    <div>
      {entities.map((entity) => (
        <AlertRow
          key={entity.id}
          entity={entity}
          entityPath={buildPath ? buildPath(entity.id) : null}
          tabKey={tabKey}
        />
      ))}
    </div>
  );
}

function MaintenanceAlertRow({ record, entityPath }) {
  const entityLabel = record.truck_number
    ? `Truck #${record.truck_number}`
    : `Trailer #${record.trailer_number}`;

  return (
    <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
      <div className="d-flex align-items-center gap-2">
        <i className="bi bi-wrench-adjustable text-danger fs-3" />
        <div>
          <div className="fw-semibold">
            {entityPath ? (
              <Link to={entityPath}>{entityLabel}</Link>
            ) : (
              <span>{entityLabel}</span>
            )}
          </div>
          <div className="small text-muted">
            Last maintenance: {record.date}
          </div>
          {record.time_alert_triggered && (
            <div className="small">
              <i className="bi bi-exclamation-circle-fill text-danger me-1" />
              Alert for maintenance at {record.alert_date}
              {record.detail ? ` — ${record.detail}` : ''}
            </div>
          )}
          {record.miles_alert_triggered && (
            <div className="small">
              <i className="bi bi-exclamation-circle-fill text-danger me-1" />
              Alert for maintenance, miles traveled {record.miles_traveled} (Alert at {record.miles_threshold})
              {record.detail ? ` — ${record.detail}` : ''}
            </div>
          )}
        </div>
      </div>
      {entityPath && (
        <Link to={entityPath} className="btn btn-sm btn-teal ms-2">
          <i className="bi bi-arrow-right-circle" />
        </Link>
      )}
    </div>
  );
}

function MaintenanceAlertList({ records, buildPath }) {
  if (!records || records.length === 0) {
    return <p className="text-muted mt-3 mb-0">No maintenance alerts.</p>;
  }
  return (
    <div>
      {records.map((record) => {
        const id = record.truck_id ?? record.trailer_id;
        return (
          <MaintenanceAlertRow
            key={`${record.maintenance_id}`}
            record={record}
            entityPath={buildPath ? buildPath(id) : null}
          />
        );
      })}
    </div>
  );
}

function TabBadge({ count, icon }) {
  if (!count || count <= 0) return null;
  return (
    <span className="badge bg-danger ms-1">
      {icon && <i className={`bi ${icon} me-1`} />}
      {count}
    </span>
  );
}

function StatCard({ label, value, bg, pct, icon }) {
  if (value == null) return null;
  return (
    <div className={`card text-white ${bg} mb-3`}>
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-1">
          {icon && <i className={`bi ${icon} opacity-75`} />}
          <div className="small text-uppercase fw-semibold opacity-75">{label}</div>
        </div>
        <div className="display-6 fw-bold">{value}</div>
        {pct != null && (
          <>
            <div
              className="progress mt-2"
              style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.3)' }}
            >
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

const TAB_PATHS = {
  drivers: (id) => `/drivers/${id}`,
  trucks: (id) => `/fleet/trucks/${id}`,
  trailers: (id) => `/fleet/trailers/${id}`,
  categories: null,
};

const MAINTENANCE_PATHS = {
  trucks: (id) => `/fleet/trucks/${id}`,
  trailers: (id) => `/fleet/trailers/${id}`,
};

export default function HomePage() {
  const { user, can, haveAnyPermission } = useAuth();
  const { data, loading } = useDashboard();
  const [activeTab, setActiveTab] = useState('drivers');

  const counts = data?.counts ?? {};
  const alerts = data?.expiration_alerts ?? {};
  const maintenanceAlerts = data?.maintenance_alerts ?? {};
  const stats = data?.stats ?? {};

  // Role-based visibility — mirrors legacy _isAD and admin checks
  const showLoadsInDispatch = haveAnyPermission(['admin', 'dispatcher']);
  const showAdminStats = can('admin');

  const invoicedPct =
    stats.executed_loads > 0
      ? Math.round((stats.invoiced / stats.executed_loads) * 100)
      : null;

  function renderTabContent() {
    if (activeTab === 'calendar') {
      return (
        <>
          <div className="d-flex justify-content-end mb-2">
            <Link to="/dispatch/my-calendar" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-list-ul me-1" />
              View Full List
            </Link>
          </div>
          <WorkCalendar selfOnly={true} />
        </>
      );
    }

    const buildPath = TAB_PATHS[activeTab];
    const entities = alerts[activeTab] ?? [];
    const hasMaintenance = activeTab === 'trucks' || activeTab === 'trailers';
    const maintenanceRecords = maintenanceAlerts[activeTab] ?? [];
    const buildMaintenancePath = MAINTENANCE_PATHS[activeTab] ?? null;

    return (
      <>
        <h6 className="text-muted mb-2">
          <i className="bi bi-calendar-event me-1" />
          Expiration Dates Alerts
        </h6>
        <AlertList entities={entities} buildPath={buildPath} tabKey={activeTab} />

        {hasMaintenance && (
          <>
            <h6 className="text-muted mt-3 mb-2">
              <i className="bi bi-wrench-adjustable me-1" />
              Maintenance Alerts
            </h6>
            <MaintenanceAlertList
              records={maintenanceRecords}
              buildPath={buildMaintenancePath}
            />
          </>
        )}
      </>
    );
  }

  // Determine whether there's any stat to show at all
  const hasAnyStats =
    showLoadsInDispatch || showAdminStats;

  return (
    <div>
      <h5 className="mb-3">Welcome, {user?.full_name || user?.username}</h5>

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {!loading && (
        <div className="row">
          {/* Left column: expiration alert tabs */}
          <div className={hasAnyStats ? 'col-lg-9' : 'col-12'}>
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
                        <TabBadge count={counts[tab.countKey]} />
                        {tab.maintenanceKey && (
                          <TabBadge
                            count={counts[tab.maintenanceKey]}
                            icon="bi-wrench-adjustable"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-body">
                {renderTabContent()}
              </div>
            </div>
          </div>

          {/* Right column: stat cards — only rendered if user has permission */}
          {hasAnyStats && (
            <div className="col-lg-3">
              {showLoadsInDispatch && (
                <StatCard
                  label="Loads in Dispatch"
                  value={stats.loads_in_dispatch}
                  bg="bg-primary"
                  icon="bi-basket"
                />
              )}
              {showAdminStats && (
                <>
                  <StatCard
                    label="Executed Loads"
                    value={stats.executed_loads}
                    bg="bg-success"
                    icon="bi-check-circle"
                  />
                  <StatCard
                    label="Invoiced"
                    value={stats.invoiced}
                    bg="bg-info"
                    icon="bi-file-earmark-text"
                    pct={invoicedPct}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
