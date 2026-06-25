import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AssignLoadModal from './AssignLoadModal';
import RateLoadModal from './RateLoadModal';
import BrokersStatusModal from '../../components/BrokersStatusModal';
import DateRangePicker from '../../components/DateRangePicker';
import SendDriverInfoModal from '../../components/SendDriverInfoModal';
import { useAuth } from '../../contexts/useAuth';
import { useLoads } from '../../hooks/useLoads';
import { brokersService } from '../../services/brokers';
import { citiesService } from '../../services/cities';
import { driversService } from '../../services/drivers';
import { loadsService, LOAD_STATUS } from '../../services/loads';
import { rtlService } from '../../services/rtl';
import { usersService } from '../../services/users';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: '1', label: 'Registered' },
  { value: '2', label: 'Started' },
  { value: '3', label: 'Finished' },
  { value: '4', label: 'Detention Pending' },
  { value: '5', label: 'Cancelled' },
];

const DATE_TYPE_OPTIONS = [
  { value: 'all', label: 'Show all (Ignore dates)' },
  { value: 'pickup', label: 'Pickup date' },
  { value: 'dropoff', label: 'Delivery date' },
  { value: 'created', label: 'Created date' },
];

const GRID_FILTER_FIELDS = ['broker', 'number', 'pickup_city', 'dropoff_city', 'driver', 'status'];
const EMPTY_LOADS = [];
const LOADS_PAGE_SIZE = 25;

function compactFilters(draft) {
  const params = { history: false };
  Object.entries(draft).forEach(([key, value]) => {
    if (value !== '' && value != null) params[key] = value;
  });
  return params;
}

function withGridMode(params, { page = 1, showAllRows = false } = {}) {
  const base = { ...params };
  delete base.page;
  delete base.page_size;
  delete base.all;
  if (showAllRows) return { ...base, all: true };
  return { ...base, page, page_size: LOADS_PAGE_SIZE };
}

function buildLoadParams(draft, options) {
  return withGridMode(compactFilters(draft), options);
}

function formatMoney(value) {
  const number = Number(value || 0);
  return number.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const RTL_EVENT_LABEL = {
  DS_D:     'Driving',
  DS_ON:    'On Duty',
  DS_SB:    'Sleeper',
  DS_OFF:   'Off Duty',
  DS_PC:    'PC',
  DS_YM:    'YM',
  DS_WT:    'WT',
  DR_IND_PC:'Personal Use',
};

const RTL_BADGE_CLS = {
  DS_D:  'success',
  DS_ON: 'success',
  VIOL:  'danger',
};

function rtlBadgeCls(code, hasViolations) {
  if (hasViolations) return 'danger';
  return RTL_BADGE_CLS[code] || 'secondary';
}

function StatusBadge({ status }) {
  const s = LOAD_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function BooleanMark({ active, title, activeIcon = 'bi-check-lg', inactiveIcon = 'bi-dash-lg' }) {
  return (
    <i
      className={`bi ${active ? activeIcon : inactiveIcon} ${active ? 'text-success' : 'text-muted opacity-50'}`}
      title={title}
    />
  );
}

function DocumentLink({ href, icon, label, color }) {
  const classes = `bi ${icon} ${href ? color : 'text-muted opacity-25'}`;
  if (!href) return <i className={classes} title={`${label} missing`} />;
  return (
    <a href={href} target="_blank" rel="noreferrer" title={label} className="load-doc-link">
      <i className={classes} />
    </a>
  );
}

function RatingStar({ complete, onClick }) {
  return (
    <button
      type="button"
      className="btn btn-link p-0"
      title={complete ? 'Ratings complete — click to update' : 'Set ratings'}
      aria-label="Set load ratings"
      onClick={onClick}
    >
      <i
        className={`bi ${complete ? 'bi-star-fill' : 'bi-star'} ${complete ? 'text-warning' : 'text-warning opacity-75'}`}
      />
    </button>
  );
}

function DriverPhoto({ load }) {
  if (load.driver_photo) {
    return <img src={load.driver_photo} alt="" className="load-driver-photo" />;
  }
  return <div className="load-driver-photo load-driver-photo-empty"><i className="bi bi-person" /></div>;
}

function CityCell({ city, zip, date, isDrop, daysInDrop }) {
  return (
    <div className="load-city-cell">
      <div>
        <span>{city || '—'}</span>
        {zip ? <span className="load-zip"> {zip}</span> : null}
        {isDrop ? (
          <span className="ms-1 text-info" title="Trailer Drop Here">
            <i className="bi bi-sign-turn-right" />
            {daysInDrop ? <small className="ms-1">({daysInDrop}d)</small> : null}
          </span>
        ) : null}
      </div>
      <div className="text-muted small">{formatDateTime(date)}</div>
    </div>
  );
}

function DispatcherSelect({ value, onChange, currentUser, onScopeChange }) {
  const wrapperRef = useRef(null);
  const [dispatchers, setDispatchers] = useState([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    usersService.options({ dispatchers: 1 })
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.results || [];
        if (!cancelled) setDispatchers(items.filter((user) => user.is_dispatcher !== false));
      })
      .catch(() => {
        if (!cancelled) setDispatchers([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const currentUserId = currentUser?.user_id ? String(currentUser.user_id) : '';
  const mine = currentUserId ? dispatchers.find((dispatcher) => String(dispatcher.id) === currentUserId) : null;
  const selected = dispatchers.find((dispatcher) => String(dispatcher.id) === String(value));
  const otherDispatchers = dispatchers.filter((dispatcher) => String(dispatcher.id) !== currentUserId);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (label) => label.toLowerCase().includes(normalizedQuery);
  const filteredOthers = otherDispatchers.filter((dispatcher) => matches(dispatcher.label || dispatcher.full_name || ''));
  const showAllOption = !normalizedQuery || matches('All dispatchers');
  const showMineOption = mine && (!normalizedQuery || matches(`My loads ${mine.label || mine.full_name || ''}`));

  useEffect(() => {
    if (!value) {
      onScopeChange?.('All Loads');
      return;
    }
    if (currentUserId && String(value) === currentUserId) {
      onScopeChange?.('My Loads');
      return;
    }
    if (selected) onScopeChange?.(`${selected.label || selected.full_name} Loads`);
  }, [currentUserId, onScopeChange, selected, value]);

  const choose = (dispatcher) => {
    onChange(String(dispatcher.id));
    setQuery('');
    setOpen(false);
  };

  const chooseAll = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const chooseMine = () => {
    if (!mine) return;
    onChange(String(mine.id));
    setQuery('');
    setOpen(false);
  };

  const clear = (event) => {
    event.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="dispatcher-select" ref={wrapperRef}>
      <button
        type="button"
        className={`dispatcher-select-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? '' : 'text-muted'}>
          {selected && currentUserId && String(selected.id) === currentUserId
            ? 'My loads'
            : selected?.label || selected?.full_name || 'All dispatchers'}
        </span>
        <span className="dispatcher-select-icons">
          {selected ? (
            <i
              className="bi bi-x-lg"
              role="button"
              tabIndex={0}
              title="Clear dispatcher"
              onClick={clear}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') clear(event);
              }}
            />
          ) : null}
          <i className={`bi ${open ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} />
        </span>
      </button>

      {open && (
        <div className="dispatcher-select-menu">
          <div className="dispatcher-select-search">
            <input
              autoFocus
              className="form-control form-control-sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search dispatcher"
            />
            <i className="bi bi-search" />
          </div>
          <div className="dispatcher-select-options">
            {!showAllOption && !showMineOption && filteredOthers.length === 0 ? (
              <div className="dispatcher-select-empty">No dispatchers found</div>
            ) : (
              <>
                {showAllOption ? (
                  <button type="button" className={!value ? 'active' : ''} onClick={chooseAll}>
                    <span>All dispatchers</span>
                  </button>
                ) : null}
                {showMineOption ? (
                  <button type="button" className={String(value) === currentUserId ? 'active' : ''} onClick={chooseMine}>
                    <span>My loads</span>
                    <small>{mine.label || mine.full_name}</small>
                  </button>
                ) : null}
                {filteredOthers.map((dispatcher) => (
                  <button
                    key={dispatcher.id}
                    type="button"
                    className={String(dispatcher.id) === String(value) ? 'active' : ''}
                    onClick={() => choose(dispatcher)}
                  >
                    <span>{dispatcher.label || dispatcher.full_name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, displayValue, placeholder, onSelect, onClear, fetchOptions }) {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [optLoading, setOptLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOptLoading(true);
    fetchOptions(query)
      .then((items) => { if (!cancelled) { setOptions(items); setOptLoading(false); } })
      .catch(() => { if (!cancelled) { setOptions([]); setOptLoading(false); } });
    return () => { cancelled = true; };
  }, [open, query, fetchOptions]);

  useEffect(() => {
    const handler = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (opt) => { onSelect(opt); setQuery(''); setOpen(false); };
  const handleClear = (e) => { e.stopPropagation(); onClear(); setQuery(''); setOpen(false); };

  return (
    <div className="filter-select-wrap" ref={wrapperRef}>
      <button
        type="button"
        className={`filter-select-trigger form-control form-control-sm${open ? ' active' : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className={displayValue ? '' : 'text-muted'}>{displayValue || placeholder}</span>
        <span className="filter-select-icons">
          {displayValue ? (
            <i
              className="bi bi-x-lg"
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e); }}
            />
          ) : null}
          <i className={`bi ${open ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} />
        </span>
      </button>
      {open && (
        <div className="dispatcher-select-menu">
          <div className="dispatcher-select-search">
            <input
              autoFocus
              className="form-control form-control-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
            />
            <i className="bi bi-search" />
          </div>
          <div className="dispatcher-select-options">
            {optLoading && <div className="dispatcher-select-empty">Loading…</div>}
            {!optLoading && options.length === 0 && (
              <div className="dispatcher-select-empty">{query ? 'No results' : 'Type to search'}</div>
            )}
            {!optLoading && options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={String(opt.id) === String(value) ? 'active' : ''}
                onClick={() => handleSelect(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function isLoadStarted(load) {
  if (!load.pickup_date || !load.dropoff_date) return false;
  if (![1, 2, 3].includes(load.status)) return false;
  const now = Date.now();
  const puB6 = new Date(load.pickup_date).getTime() - 6 * 3600 * 1000;
  const dropA8 = new Date(load.dropoff_date).getTime() + 8 * 3600 * 1000;
  return now >= puB6 && now <= dropA8;
}

function LoadRow({ load, selected, onSelect, onChanged, onAssign, onRate }) {
  const [actioning, setActioning] = useState(false);
  const trailerType = load.load_trailer_type_short_name || load.trailer_type_short_name || '-';
  const brokerTitle = load.broker_debtor_buy_status || load.broker_buy_status || 'Broker status';
  const ratingsComplete = Boolean(load.shipper_rating && load.receiver_rating);
  const showRtlBadge = Boolean(load.driver_rtl_event_code && isLoadStarted(load));

  const handleStatus = async (newStatus) => {
    if (!window.confirm(`Change status to ${LOAD_STATUS[newStatus]?.label}?`)) return;
    setActioning(true);
    try {
      await loadsService.setStatus(load.id, newStatus);
      onChanged();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not change status.');
    } finally {
      setActioning(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete load ${load.number}?`)) return;
    setActioning(true);
    try {
      await loadsService.destroy(load.id);
      onChanged();
    } catch (err) {
      window.alert(err.response?.data?.detail || 'Could not delete load.');
    } finally {
      setActioning(false);
    }
  };

  const handleExecute = async () => {
    if (!window.confirm('Send this load to executed?')) return;
    setActioning(true);
    try {
      await loadsService.setExecuted(load.id);
      onChanged();
    } finally {
      setActioning(false);
    }
  };

  return (
    <tr className={load.status === 4 ? 'row-detention' : ''}>
      <td className="text-center">
        <input
          className="form-check-input"
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(load.id)}
          aria-label={`Select load ${load.number}`}
        />
      </td>
      <td className="text-center text-muted">{load.id}</td>
      <td className="text-center"><DriverPhoto load={load} /></td>
      <td className="text-center">
        <Link
          to={`/loads/${load.id}`}
          className={`load-broker-link ${load.broker_denied ? 'broker-denied' : ''}`}
          title={brokerTitle}
        >
          {load.broker_name || (load.broker ? `Broker #${load.broker}` : '—')}
          {load.broker_contacts ? <i className="bi bi-info-circle-fill ms-1" /> : null}
        </Link>
        {load.carrier_name ? <div className="text-muted load-subline">{load.carrier_name}</div> : null}
      </td>
      <td className="text-center">
        <Link to={`/loads/${load.id}`} className="fw-semibold text-decoration-none">{load.number}</Link>
        <div className="text-muted small">({trailerType})</div>
        <div className="text-success fw-semibold small">({formatMoney(load.payment)})</div>
      </td>
      <td>
        <CityCell
          city={load.pickup_city_display}
          zip={load.pickup_city_zip}
          date={load.pickup_date}
        />
      </td>
      <td>
        <CityCell
          city={load.dropoff_city_display}
          zip={load.dropoff_city_zip}
          date={load.dropoff_date}
          isDrop={Boolean(load.is_drop)}
          daysInDrop={load.days_in_drop}
        />
      </td>
      <td className="text-center">
        {load.driver_name ? (
          <>
            <Link to={`/drivers/${load.driver}`} className="fw-semibold text-decoration-none">
              {load.driver_name}
              {load.driver_code ? <span className="text-muted"> ({load.driver_code})</span> : null}
            </Link>
            {load.team_driver_name ? <div className="small text-muted">Team: {load.team_driver_name}</div> : null}
            <div className="text-success fw-semibold small">
              {load.truck_number || '—'} - {load.trailer_number || '—'}
              {load.trailer_type_short_name ? ` (${load.trailer_type_short_name})` : ''}
            </div>
            {showRtlBadge ? (
              load.driver_rtl_id ? (
                <Link
                  to={`/integrations/rtl/drivers/${load.driver_rtl_id}`}
                  className={`badge bg-${rtlBadgeCls(load.driver_rtl_event_code, load.driver_rtl_has_violations)} mt-1 text-decoration-none`}
                >
                  {RTL_EVENT_LABEL[load.driver_rtl_event_code] || load.driver_rtl_event_code}
                </Link>
              ) : (
                <span className={`badge bg-${rtlBadgeCls(load.driver_rtl_event_code, load.driver_rtl_has_violations)} mt-1`}>
                  {RTL_EVENT_LABEL[load.driver_rtl_event_code] || load.driver_rtl_event_code}
                </span>
              )
            ) : null}
          </>
        ) : (
          <span className="text-muted small">Unassigned</span>
        )}
      </td>
      <td className="text-center load-docs">
        <DocumentLink href={load.rate_file} icon="bi-file-earmark-ruled" label="Rate confirmation" color="text-primary" />
        <DocumentLink href={load.lumper_file} icon="bi-file-earmark-medical" label="Lumper receipt" color="text-danger" />
      </td>
      <td className="text-center load-docs">
        <DocumentLink href={load.bill_file} icon="bi-file-earmark-text" label="Bill of lading" color="text-success" />
        <DocumentLink href={load.detention_file} icon="bi-file-earmark-clock" label="Detention file" color="text-warning" />
      </td>
      <td className="text-center">
        <div className="d-flex gap-1 justify-content-center flex-nowrap">
          <Link to={`/loads/${load.id}`} className="btn btn-sm btn-link p-0" title="View">
            <i className="bi bi-eye" />
          </Link>
          <Link to={`/loads/${load.id}/edit`} className="btn btn-sm btn-link p-0" title="Edit">
            <i className="bi bi-pencil-fill" />
          </Link>
          <button className="btn btn-sm btn-link p-0 text-danger" onClick={handleDelete} disabled={actioning} title="Delete">
            <i className="bi bi-trash" />
          </button>
        </div>
      </td>
      <td className="text-center">
        {load.status !== 4 && (
          <div className="dropdown">
            <button className="btn btn-sm btn-secondary dropdown-toggle" data-bs-toggle="dropdown" disabled={actioning}>
              Status
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><button className="dropdown-item" onClick={() => handleStatus(3)}><i className="bi bi-check-circle me-1 text-success" />Delivered</button></li>
              <li><button className="dropdown-item" onClick={() => handleStatus(4)}><i className="bi bi-pause-circle me-1 text-warning" />Mark as Detention</button></li>
              {load.status === 1 && (
                <li><button className="dropdown-item text-danger" onClick={() => handleStatus(5)}><i className="bi bi-x-circle me-1" />Cancel Load</button></li>
              )}
            </ul>
          </div>
        )}
      </td>
      <td className="text-center">
        <button
          type="button"
          className="btn btn-link p-0 load-assignment-link"
          title="Truck, trailer and driver assignment"
          aria-label="Assign truck, trailer and driver"
          onClick={() => onAssign(load)}
        >
          {load.assignment_complete
            ? <i className="bi bi-check-lg text-success" />
            : <i className="bi bi-truck text-muted" />}
        </button>
      </td>
      <td className="text-center"><RatingStar complete={ratingsComplete} onClick={() => onRate(load)} /></td>
      <td className="text-center">
        {load.ready_to_execute && !load.execute ? (
          <button
            className="btn btn-link p-0 text-primary"
            title="Send to executed"
            aria-label="Send load to executed"
            disabled={actioning}
            onClick={handleExecute}
          >
            <i className="bi bi-arrow-right-circle-fill" />
          </button>
        ) : (
          <i
            className={`bi bi-arrow-right-circle ${load.execute ? 'text-success' : 'text-muted opacity-25'}`}
            title={load.execute ? 'Already executed' : 'Not ready to execute'}
          />
        )}
      </td>
      <td className="text-center"><StatusBadge status={load.status} /></td>
      <td className="text-center"><BooleanMark active={load.invoiced} title={load.invoiced ? 'Invoiced' : 'Not invoiced'} /></td>
      <td className="text-center"><BooleanMark active={load.paid} title={load.paid ? 'Paid' : 'Not paid'} /></td>
    </tr>
  );
}

export default function LoadsPage() {
  const auth = useAuth() || {};
  const user = auth.user;
  const didDefaultDispatcher = useRef(false);
  const initialDraft = useMemo(() => ({ date_type: 'all', status: '' }), []);
  const [draft, setDraft] = useState(initialDraft);
  const [filters, setFilters] = useState(buildLoadParams(initialDraft));
  const [page, setPage] = useState(1);
  const [showAllRows, setShowAllRows] = useState(false);
  const [gridCleared, setGridCleared] = useState(false);
  const [loadScopeTitle, setLoadScopeTitle] = useState('All Loads');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showDriverInfoModal, setShowDriverInfoModal] = useState(false);
  const [showBrokersStatusModal, setShowBrokersStatusModal] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [assigningLoad, setAssigningLoad] = useState(null);
  const [ratingLoad, setRatingLoad] = useState(null);
  const [filterLabels, setFilterLabels] = useState({});
  const driverCacheRef = useRef(null);
  const { loads, count = 0, loading, error, refresh } = useLoads(filters);

  const fetchBrokerOptions = useCallback(async (q) => {
    if (!q.trim()) {
      const { data } = await brokersService.options();
      return Array.isArray(data) ? data : [];
    }
    const { data } = await brokersService.search(q);
    const items = Array.isArray(data) ? data : [];
    return items.map((b) => ({ id: b.id, label: `${b.dba_name || b.name} (${b.mc})` }));
  }, []);

  const fetchDriverOptions = useCallback(async (q) => {
    if (!driverCacheRef.current) {
      const { data } = await driversService.list();
      driverCacheRef.current = Array.isArray(data) ? data : (data.results || []);
    }
    const norm = q.trim().toLowerCase();
    return driverCacheRef.current
      .filter((d) => !norm || (d.full_name || `${d.first_name} ${d.last_name}`).toLowerCase().includes(norm))
      .map((d) => ({ id: d.id, label: d.full_name || `${d.first_name} ${d.last_name}` }));
  }, []);

  const fetchCityOptions = useCallback(async (q) => {
    if (!q.trim()) return [];
    const { data } = await citiesService.list({ q, active: true });
    const items = Array.isArray(data) ? data : (data.results || []);
    return items.map((c) => ({ id: c.id, label: `${c.name} (${c.state_abbreviation}) ${c.zip}` }));
  }, []);
  const visibleLoads = gridCleared ? EMPTY_LOADS : loads;

  useEffect(() => {
    if (didDefaultDispatcher.current || !user?.roles?.includes('dispatcher') || !user.user_id) return;
    didDefaultDispatcher.current = true;
    setDraft((current) => {
      if (current.dispatcher) return current;
      const next = { ...current, dispatcher: String(user.user_id) };
      setPage(1);
      setFilters(buildLoadParams(next));
      return next;
    });
  }, [user]);

  const visibleIds = useMemo(() => (gridCleared ? [] : loads.map((load) => load.id)), [gridCleared, loads]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const totalCount = gridCleared ? 0 : count;
  const showingFrom = visibleLoads.length === 0 ? 0 : (showAllRows ? 1 : ((page - 1) * LOADS_PAGE_SIZE) + 1);
  const showingTo = visibleLoads.length === 0 ? 0 : Math.min(showingFrom + visibleLoads.length - 1, totalCount || visibleLoads.length);
  const totalPages = showAllRows ? 1 : Math.max(1, Math.ceil((totalCount || 0) / LOADS_PAGE_SIZE));
  const itemsLabel = totalCount === 1 ? 'item' : 'items';

  const applyFilters = (nextDraft = draft) => {
    setPage(1);
    setFilters(buildLoadParams(nextDraft, { page: 1, showAllRows }));
    setGridCleared(false);
    setSelectedIds(new Set());
  };

  const handleFilter = (event) => {
    event.preventDefault();
    applyFilters();
  };

  const handleReset = () => {
    setDraft(initialDraft);
    setFilterLabels({});
    setShowAllRows(false);
    setPage(1);
    setFilters(buildLoadParams(initialDraft, { page: 1, showAllRows: false }));
    setGridCleared(false);
    setSelectedIds(new Set());
  };

  const setField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const submitOnEnter = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      if (allSelected) return new Set();
      return new Set([...current, ...visibleIds]);
    });
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected load${ids.length === 1 ? '' : 's'}?`)) return;
    try {
      await loadsService.bulkDelete(ids);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      window.alert(err.response?.data?.detail || 'Could not delete selected loads.');
    }
  };

  const handleGridReset = () => {
    setDraft((current) => {
      const next = { ...current };
      GRID_FILTER_FIELDS.forEach((field) => {
        next[field] = '';
      });
      return next;
    });
    setFilterLabels({});
    setSelectedIds(new Set());
    setGridCleared(true);
  };

  const isDispatcher = Boolean(user?.roles?.includes('dispatcher'));
  const isMyLoadsScope = Boolean(
    isDispatcher &&
    draft.dispatcher &&
    String(draft.dispatcher) === String(user?.user_id)
  );

  const handleListAllLoads = () => {
    const nextDraft = { ...draft, status: '', dispatcher: '', date_type: 'all', date_from: '', date_to: '' };
    setDraft(nextDraft);
    setShowAllRows(false);
    setPage(1);
    setFilters(buildLoadParams(nextDraft, { page: 1, showAllRows: false }));
    setGridCleared(false);
    setSelectedIds(new Set());
  };

  const handleListMyLoads = () => {
    const nextDraft = { date_type: 'all', status: '', dispatcher: String(user.user_id) };
    setDraft(nextDraft);
    setFilterLabels({});
    setShowAllRows(false);
    setPage(1);
    setFilters(buildLoadParams(nextDraft, { page: 1, showAllRows: false }));
    setGridCleared(false);
    setSelectedIds(new Set());
  };

  const handleToggleRowsMode = () => {
    setShowAllRows((current) => {
      const nextShowAllRows = !current;
      setPage(1);
      setGridCleared(false);
      setSelectedIds(new Set());
      setFilters((currentFilters) => withGridMode(currentFilters, { page: 1, showAllRows: nextShowAllRows }));
      return nextShowAllRows;
    });
  };

  const handleUpdateLocation = async () => {
    if (!window.confirm("Are you sure you want to update driver's location?")) return;
    setUpdatingLocation(true);
    try {
      await rtlService.fetchAndSync();
      refresh();
      window.alert("Driver's location updated successfully!");
    } catch {
      window.alert("Driver's location could not be updated. Please try again.");
    } finally {
      setUpdatingLocation(false);
    }
  };

  const goToPage = (nextPage) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    if (boundedPage === page || showAllRows) return;
    setPage(boundedPage);
    setGridCleared(false);
    setSelectedIds(new Set());
    setFilters((currentFilters) => withGridMode(currentFilters, { page: boundedPage, showAllRows: false }));
  };

  return (
    <div className="loads-page">
      <form className="load-search-band" onSubmit={handleFilter}>
        <div className="load-filter">
          <label>Select date range</label>
          <DateRangePicker
            start={draft.date_from || ''}
            end={draft.date_to || ''}
            onApply={({ start, end }) => {
              setDraft((current) => ({ ...current, date_from: start, date_to: end }));
            }}
          />
        </div>
        <div className="load-filter">
          <label>Filter by date type search</label>
          <select className="form-select form-select-sm" value={draft.date_type || 'all'} onChange={(e) => setField('date_type', e.target.value)}>
            {DATE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="load-filter">
          <label>Filter by dispatcher</label>
          <DispatcherSelect
            value={draft.dispatcher || ''}
            onChange={(value) => setField('dispatcher', value)}
            currentUser={user}
            onScopeChange={setLoadScopeTitle}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-sm load-search-button">
          <i className="bi bi-search me-1" />Search
        </button>
      </form>

      {error && <div className="alert alert-danger">Error loading data.</div>}

      <section className="card loads-grid-card">
        <div className="card-header loads-grid-heading">
          <h5><i className="bi bi-basket2-fill me-2" />{loadScopeTitle}</h5>
          <span>
            {showAllRows
              ? `Total ${totalCount} ${itemsLabel}.`
              : `Showing ${visibleLoads.length ? `${showingFrom}-${showingTo}` : '0'} of ${totalCount} ${itemsLabel}.`}
          </span>
        </div>
        <div className="loads-grid-toolbar">
          <button
            className="btn btn-link btn-sm"
            type="button"
            onClick={isMyLoadsScope ? handleListAllLoads : (isDispatcher ? handleListMyLoads : handleListAllLoads)}
          >
            <i className={`bi ${isDispatcher && !isMyLoadsScope ? 'bi-person-fill' : 'bi-list-ul'} me-1`} />
            {isMyLoadsScope ? 'List all loads' : (isDispatcher ? 'List only my loads' : 'List all loads')}
          </button>
          <div className="ms-auto btn-group btn-group-sm">
            <Link to="/loads/create" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />New Load</Link>
            <button className="btn btn-info text-white load-grid-tool-btn" type="button" onClick={handleGridReset} title="Reset Grid" aria-label="Reset Grid"><i className="bi bi-eraser-fill" /></button>
            <button className="btn btn-info text-white load-grid-tool-btn" type="button" onClick={handleToggleRowsMode} title={showAllRows ? 'Show paged data' : 'Show all rows'}>
              <i className={`bi ${showAllRows ? 'bi-arrows-angle-contract' : 'bi-arrows-angle-expand'} me-1`} />{showAllRows ? 'Page' : 'All'}
            </button>
            <button className="btn btn-success" onClick={() => setShowDriverInfoModal(true)}><i className="bi bi-truck me-1" />Driver info</button>
            <button className="btn btn-primary" onClick={() => setShowBrokersStatusModal(true)}><i className="bi bi-person-x-fill me-1" />Brokers status</button>
            <button className="btn btn-secondary" onClick={handleUpdateLocation} disabled={updatingLocation}>
              {updatingLocation
                ? <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />Updating...</>
                : <><i className="bi bi-geo-alt-fill me-1" />Update location</>}
            </button>
          </div>
        </div>

        <div className="table-responsive loads-table-wrap">
          <table className="table table-sm table-hover table-striped align-middle loads-table mb-0">
            <thead>
              <tr className="loads-filter-row">
                <th className="text-center">
                  <input className="form-check-input" type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all loads" />
                </th>
                <th className="text-center">#</th>
                <th className="text-center"><i className="bi bi-image text-primary" /></th>
                <th>
                  <label>Broker</label>
                  <FilterSelect
                    value={draft.broker || ''}
                    displayValue={filterLabels.broker || ''}
                    placeholder="Broker"
                    fetchOptions={fetchBrokerOptions}
                    onSelect={(opt) => {
                      const nd = { ...draft, broker: String(opt.id) };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, broker: opt.label }));
                      applyFilters(nd);
                    }}
                    onClear={() => {
                      const nd = { ...draft, broker: '' };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, broker: '' }));
                      applyFilters(nd);
                    }}
                  />
                </th>
                <th>
                  <label>Order</label>
                  <input className="form-control form-control-sm" value={draft.number || ''} onChange={(e) => setField('number', e.target.value)} onKeyDown={submitOnEnter} placeholder="Order" />
                </th>
                <th>
                  <label>Pick up City</label>
                  <FilterSelect
                    value={draft.pickup_city || ''}
                    displayValue={filterLabels.pickup_city || ''}
                    placeholder="Filter by Pick up city"
                    fetchOptions={fetchCityOptions}
                    onSelect={(opt) => {
                      const nd = { ...draft, pickup_city: String(opt.id) };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, pickup_city: opt.label }));
                      applyFilters(nd);
                    }}
                    onClear={() => {
                      const nd = { ...draft, pickup_city: '' };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, pickup_city: '' }));
                      applyFilters(nd);
                    }}
                  />
                </th>
                <th>
                  <label>Delivery City</label>
                  <FilterSelect
                    value={draft.dropoff_city || ''}
                    displayValue={filterLabels.dropoff_city || ''}
                    placeholder="Filter by Drop off city"
                    fetchOptions={fetchCityOptions}
                    onSelect={(opt) => {
                      const nd = { ...draft, dropoff_city: String(opt.id) };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, dropoff_city: opt.label }));
                      applyFilters(nd);
                    }}
                    onClear={() => {
                      const nd = { ...draft, dropoff_city: '' };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, dropoff_city: '' }));
                      applyFilters(nd);
                    }}
                  />
                </th>
                <th>
                  <label>Driver</label>
                  <FilterSelect
                    value={draft.driver || ''}
                    displayValue={filterLabels.driver || ''}
                    placeholder="Driver"
                    fetchOptions={fetchDriverOptions}
                    onSelect={(opt) => {
                      const nd = { ...draft, driver: String(opt.id) };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, driver: opt.label }));
                      applyFilters(nd);
                    }}
                    onClear={() => {
                      const nd = { ...draft, driver: '' };
                      setDraft(nd);
                      setFilterLabels((p) => ({ ...p, driver: '' }));
                      applyFilters(nd);
                    }}
                  />
                </th>
                <th className="text-center"><i className="bi bi-file-earmark-ruled text-primary" title="Rate Confirmation" /><i className="bi bi-file-earmark-medical text-danger ms-1" title="Lumper file" /></th>
                <th className="text-center"><i className="bi bi-file-earmark-text text-success" title="Bill of lading" /><i className="bi bi-file-earmark-clock text-warning ms-1" title="Detention file" /></th>
                <th className="text-center">Actions</th>
                <th className="text-center">
                  <select className="form-select form-select-sm" value={draft.status || ''} onChange={(e) => { setField('status', e.target.value); applyFilters({ ...draft, status: e.target.value }); }}>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </th>
                <th className="text-center"><i className="bi bi-check-circle-fill text-success" title="Truck, Trailer and Driver Assignment" /></th>
                <th className="text-center"><i className="bi bi-star-fill text-warning" title="Set Rating" /></th>
                <th className="text-center"><i className="bi bi-arrow-right-circle-fill text-primary" title="Send to executed" /></th>
                <th className="text-center">Status</th>
                <th className="text-center"><i className="bi bi-receipt" title="Invoiced" /></th>
                <th className="text-center"><i className="bi bi-cash-coin" title="Paid" /></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={18} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td>
                </tr>
              )}
              {!loading && !error && visibleLoads.length === 0 && (
                <tr>
                  <td colSpan={18} className="text-center text-muted py-4">No loads found.</td>
                </tr>
              )}
              {!loading && visibleLoads.map((load) => (
                <LoadRow
                  key={load.id}
                  load={load}
                  selected={selectedIds.has(load.id)}
                  onSelect={toggleSelected}
                  onChanged={refresh}
                  onAssign={setAssigningLoad}
                  onRate={setRatingLoad}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="loads-bulk-bar">
          <span><i className="bi bi-arrow-right me-2" />With selected</span>
          <button className="btn btn-danger btn-sm" type="button" disabled={selectedIds.size === 0} onClick={handleBulkDelete}>
            <i className="bi bi-trash me-1" />Delete All
          </button>
          {!showAllRows && totalPages > 1 ? (
            <div className="loads-pagination ms-auto">
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>
                <i className="bi bi-chevron-left" /> Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page >= totalPages || loading} onClick={() => goToPage(page + 1)}>
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          ) : null}
          <button className={`btn btn-outline-secondary btn-sm ${showAllRows || totalPages <= 1 ? 'ms-auto' : ''}`} type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </section>

      {showDriverInfoModal && (
        <SendDriverInfoModal onClose={() => setShowDriverInfoModal(false)} />
      )}
      {showBrokersStatusModal && (
        <BrokersStatusModal onClose={() => setShowBrokersStatusModal(false)} />
      )}
      {assigningLoad && (
        <AssignLoadModal
          load={assigningLoad}
          onClose={() => setAssigningLoad(null)}
          onSaved={() => { setAssigningLoad(null); refresh(); }}
        />
      )}
      {ratingLoad && (
        <RateLoadModal
          load={ratingLoad}
          onClose={() => setRatingLoad(null)}
          onSaved={() => { setRatingLoad(null); refresh(); }}
        />
      )}
    </div>
  );
}
