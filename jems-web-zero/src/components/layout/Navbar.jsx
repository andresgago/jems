import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';

export default function Navbar() {
  const { user, logout, can, haveAnyPermission } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate('/login');
  };

  const fullName = user?.full_name || user?.username || '';

  // True when the current path equals or is nested under any of the given prefixes
  const at = (...prefixes) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const dropdownClass = (active) => `nav-link dropdown-toggle${active ? ' active' : ''}`;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark fixed-top navbar-custom">
      <div className="container-fluid">
        <Link className="navbar-brand py-0" to="/">
          <img src="/logow.png" alt="JEMS" height="40" style={{ filter: 'brightness(0) invert(1)' }} />
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav ms-auto">

            {haveAnyPermission(['admin', 'dispatcher']) && (
              <li className="nav-item dropdown">
                <a className={dropdownClass(at('/loads'))} href="#" data-bs-toggle="dropdown">
                  <i className="bi bi-box-seam me-1" />Loads
                </a>
                <ul className="dropdown-menu dropdown-menu-dark">
                  <li><Link className="dropdown-item" to="/loads">All Loads</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Processing</h6></li>
                  <li><Link className="dropdown-item" to="/loads/executed">Executed</Link></li>
                  <li><Link className="dropdown-item" to="/loads/invoicing">Invoicing</Link></li>
                  <li><Link className="dropdown-item" to="/loads/payments">Payments</Link></li>
                  {can('admin') && <li><hr className="dropdown-divider" /></li>}
                  {can('admin') && <li><Link className="dropdown-item" to="/loads/history">History</Link></li>}
                </ul>
              </li>
            )}

            {haveAnyPermission(['admin', 'assistant']) && (
              <li className="nav-item dropdown">
                <a className={dropdownClass(at('/accounting'))} href="#" data-bs-toggle="dropdown">
                  <i className="bi bi-currency-dollar me-1" />Accounting
                </a>
                <ul className="dropdown-menu dropdown-menu-dark">
                  <li><h6 className="dropdown-header">Records</h6></li>
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/records/create">Add Record</Link></li>}
                  <li><Link className="dropdown-item" to="/accounting/records">Accounting Records</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Payments</h6></li>
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/owner-operator">Owner Operator</Link></li>}
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/dispatcher-percent">Dispatcher By Percent</Link></li>}
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/dispatcher-hour">Dispatcher By Hour</Link></li>}
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Invoices</h6></li>
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/invoices/dispatchers-percent">Dispatchers by Percent</Link></li>}
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/invoices/dispatchers-hour">Dispatchers by Hour</Link></li>}
                  {can('admin') && <li><Link className="dropdown-item" to="/accounting/invoices/drivers">Drivers Invoices</Link></li>}
                </ul>
              </li>
            )}

            {haveAnyPermission(['admin', 'root']) && (
              <li className="nav-item dropdown">
                <a className={dropdownClass(at('/rtl'))} href="#" data-bs-toggle="dropdown">
                  <i className="bi bi-journal-text me-1" />RTL
                </a>
                <ul className="dropdown-menu dropdown-menu-dark">
                  <li><h6 className="dropdown-header">Manage</h6></li>
                  <li><Link className="dropdown-item" to="/rtl">Trucks / Drivers</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Reports</h6></li>
                  <li><Link className="dropdown-item" to="/rtl/ifta">IFTA</Link></li>
                </ul>
              </li>
            )}

            {haveAnyPermission(['admin', 'root']) && (
              <li className="nav-item dropdown">
                <a className={dropdownClass(at('/reports'))} href="#" data-bs-toggle="dropdown">
                  <i className="bi bi-printer me-1" />
                </a>
                <ul className="dropdown-menu dropdown-menu-dark">
                  <li><h6 className="dropdown-header">Reports</h6></li>
                  <li><Link className="dropdown-item" to="/reports/financial">Profit and Loss</Link></li>
                  <li><Link className="dropdown-item" to="/reports/invoice">Profit and Loss By Invoices</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><Link className="dropdown-item" to="/reports/ifta">IFTA</Link></li>
                  <li><Link className="dropdown-item" to="/reports/tax">Tax</Link></li>
                  <li><Link className="dropdown-item" to="/reports/category-tracking">Category Tracking</Link></li>
                  <li><Link className="dropdown-item" to="/reports/broker-summary">Broker Summary</Link></li>
                </ul>
              </li>
            )}

            {haveAnyPermission(['admin', 'basic', 'maintenance']) && (
              <li className="nav-item dropdown">
                <a className={dropdownClass(at('/fleet/truck-maintenance', '/fleet/trailer-maintenance', '/fleet/accidents'))} href="#" data-bs-toggle="dropdown">
                  <i className="bi bi-wrench-adjustable me-1" />
                </a>
                <ul className="dropdown-menu dropdown-menu-dark">
                  <li><h6 className="dropdown-header">Trucks</h6></li>
                  <li><Link className="dropdown-item" to="/fleet/truck-maintenance/create">Create Truck Maintenance</Link></li>
                  <li><Link className="dropdown-item" to="/fleet/truck-maintenance">Trucks Maintenances</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Trailers</h6></li>
                  <li><Link className="dropdown-item" to="/fleet/trailer-maintenance/create">Create Trailer Maintenance</Link></li>
                  <li><Link className="dropdown-item" to="/fleet/trailer-maintenance">Trailers Maintenances</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Accidents</h6></li>
                  <li><Link className="dropdown-item" to="/fleet/accidents">Accidents</Link></li>
                </ul>
              </li>
            )}

            <li className="nav-item dropdown">
              <a className={dropdownClass(at('/drivers', '/fleet/trucks', '/fleet/trailers', '/brokers', '/settings/business', '/settings/cities', '/settings/users'))} href="#" data-bs-toggle="dropdown">
                <i className="bi bi-gear me-1" />
              </a>
              <ul className="dropdown-menu dropdown-menu-dark">
                <li><h6 className="dropdown-header">Assets</h6></li>
                <li><Link className="dropdown-item" to="/drivers">Drivers</Link></li>
                <li><Link className="dropdown-item" to="/fleet/trucks">Trucks</Link></li>
                <li><Link className="dropdown-item" to="/fleet/trailers">Trailers</Link></li>
                <li><hr className="dropdown-divider" /></li>
                <li><h6 className="dropdown-header">Other Settings</h6></li>
                <li><Link className="dropdown-item" to="/brokers">Brokers</Link></li>
                <li><Link className="dropdown-item" to="/brokers/contacts">Brokers Contact</Link></li>
                <li><Link className="dropdown-item" to="/settings/business">Business</Link></li>
                <li><Link className="dropdown-item" to="/settings/cities">Cities</Link></li>
                <li><Link className="dropdown-item" to="/settings/users">Users</Link></li>
              </ul>
            </li>

            {haveAnyPermission(['admin', 'root']) && (
              <li className="nav-item dropdown">
                <a className={dropdownClass(at('/settings/carriers', '/settings/system', '/settings/truck-owners', '/settings/loss-payees', '/settings/driver-types', '/settings/trailer-types', '/settings/truck-types'))} href="#" data-bs-toggle="dropdown">
                  <i className="bi bi-sliders me-1" />System
                </a>
                <ul className="dropdown-menu dropdown-menu-dark">
                  <li><Link className="dropdown-item" to="/settings/carriers">Carriers</Link></li>
                  <li><Link className="dropdown-item" to="/settings/system">System Settings</Link></li>
                  <li><Link className="dropdown-item" to="/settings/truck-owners">Trucks Owners</Link></li>
                  <li><Link className="dropdown-item" to="/settings/loss-payees">Loss Payees</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><h6 className="dropdown-header">Truck / Trailer / Driver Settings</h6></li>
                  <li><Link className="dropdown-item" to="/settings/driver-types">Types of Drivers</Link></li>
                  <li><Link className="dropdown-item" to="/settings/trailer-types">Types of Trailers</Link></li>
                  <li><Link className="dropdown-item" to="/settings/truck-types">Types of Trucks</Link></li>
                </ul>
              </li>
            )}

            <li className="nav-item dropdown">
              <a className={dropdownClass(at('/dispatch'))} href="#" data-bs-toggle="dropdown">
                <i className="bi bi-person-circle me-1" />{fullName}
              </a>
              <ul className="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                <li><h6 className="dropdown-header">Calendars</h6></li>
                <li><Link className="dropdown-item" to="/dispatch/my-calendar">My Work Calendar</Link></li>
                {can('admin') && <li><Link className="dropdown-item" to="/dispatch/calendar">Dispatchers General Calendar</Link></li>}
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <a className="dropdown-item text-danger" href="#" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-1" />Logout
                  </a>
                </li>
              </ul>
            </li>

          </ul>
        </div>
      </div>
    </nav>
  );
}
