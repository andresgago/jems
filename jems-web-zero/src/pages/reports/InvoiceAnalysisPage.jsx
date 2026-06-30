import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import { driverInvoicesService } from '../../services/accounting';
import { driversService } from '../../services/drivers';
import { usersService } from '../../services/users';
import { carriersService } from '../../services/carriers';

function fmt(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const today = new Date();
const defaultEnd = fmt(today);
const defaultStart = fmt(addDays(today, -6));

// Account columns in legacy order. Each entry: [field, header, isExpense]
// isExpense=true → negate for display (stored positive in DB, show negative)
const ACC_COLS = [
  ['acc_90010', 'I-Rate',         false],
  ['acc_90011', 'I-Detention',    false],
  ['acc_80030', 'E-Fuel',         true],
  ['acc_80084', 'E-Fee',          true],
  ['acc_10040', 'E-% FDisp',      true],
  ['acc_10043', 'E-% FDispO',     true],
  ['acc_80081', 'E-Insurance',    true],
  ['acc_80011', 'E-Detention',    true],
  ['acc_80082', 'E-Driver',       true],
  ['acc_80080', 'E-Toll',         true],
  ['acc_80012', 'E-Lumper',       true],
  ['acc_10042', 'E-% FDet',       true],
  ['acc_80013', 'E-Scale & Wash', true],
  ['acc_80051', 'E-Vacation',     true],
  ['acc_90030', 'E-I-Driver',     true],
  ['acc_80035', 'E-Scale',        true],
  ['acc_80050', 'Driver Payroll', true],
  ['acc_90012', 'I-Lumper',       false],
  ['acc_80036', 'Misc',           true],
  ['acc_80056', 'BoA Fee',        true],
];

function fmtMoney(val) {
  if (val == null || val === 0) return <span className="text-muted">0.00</span>;
  const n = Number(val);
  const cls = n < 0 ? 'text-danger' : '';
  return (
    <span className={cls}>
      {n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

function displayAccVal(val, isExpense) {
  const raw = Number(val) || 0;
  if (raw === 0) return <span className="text-muted">0.00</span>;
  const display = isExpense ? -raw : raw;
  const cls = display < 0 ? 'text-danger' : '';
  return (
    <span className={cls}>
      {display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

function sumCol(rows, field, isExpense) {
  const total = rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
  if (total === 0) return <span className="text-muted">0.00</span>;
  const display = isExpense ? -total : total;
  const cls = display < 0 ? 'text-danger fw-bold' : 'fw-bold';
  return (
    <span className={cls}>
      {display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export default function InvoiceAnalysisPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [driverId, setDriverId] = useState('');
  const [dispatcherId, setDispatcherId] = useState('');
  const [carrierId, setCarrierId] = useState('');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const [driverOptions, setDriverOptions] = useState([]);
  const [dispatcherOptions, setDispatcherOptions] = useState([]);
  const [carrierOptions, setCarrierOptions] = useState([]);

  const tableRef = useRef(null);

  useEffect(() => {
    driversService.list({ status: 1 })
      .then((r) => setDriverOptions(r.data))
      .catch(() => {});
    usersService.options({ dispatchers: 1 })
      .then((r) => setDispatcherOptions(r.data))
      .catch(() => {});
    carriersService.options()
      .then((r) => setCarrierOptions(r.data))
      .catch(() => {});
  }, []);

  function buildParams() {
    const p = { date_begin: start, date_end: end };
    if (driverId) p.driver = driverId;
    if (dispatcherId) p.dispatcher = dispatcherId;
    if (carrierId) p.carrier = carrierId;
    return p;
  }

  function handleSearch() {
    setLoading(true);
    setError(null);
    driverInvoicesService.analysis(buildParams())
      .then((r) => { setRows(r.data); setSearched(true); })
      .catch(() => setError('Failed to load analysis data.'))
      .finally(() => setLoading(false));
  }

  function handleRefresh() {
    if (searched) handleSearch();
  }

  function handleAll() {
    setDriverId('');
    setDispatcherId('');
    setCarrierId('');
  }

  function shiftWeek(direction) {
    const s = new Date(start);
    const e = new Date(end);
    const days = direction * 7;
    setStart(fmt(addDays(s, days)));
    setEnd(fmt(addDays(e, days)));
  }

  const totalNet = rows.reduce((s, r) => s + (Number(r.net) || 0), 0);
  const totalGross = rows.reduce((s, r) => s + (Number(r.gross) || 0), 0);

  return (
    <div>
      {/* Date range bar — mirrors load-search-band pattern for height alignment */}
      <div className="invoice-analysis-search-band mb-3">
        <div className="load-filter" style={{ width: 380 }}>
          <label>Select date range</label>
          <div className="d-flex gap-1" style={{ height: '48px' }}>
            <button
              className="btn btn-outline-secondary h-100"
              title="Previous week"
              onClick={() => shiftWeek(-1)}
            >
              <i className="bi bi-chevron-left" />
            </button>
            <DateRangePicker
              start={start}
              end={end}
              onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }}
            />
            <button
              className="btn btn-outline-secondary h-100"
              title="Next week"
              onClick={() => shiftWeek(1)}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
        <button
          className="btn btn-success load-search-button"
          style={{ width: 136, flexShrink: 0 }}
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? <span className="spinner-border spinner-border-sm" /> : 'Search'}
        </button>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center py-2">
          <h5 className="mb-0 fw-semibold">
            <i className="bi bi-list me-1" />INVOICES ANALYSIS
            {searched && !loading && (
              <span className="text-muted fw-normal ms-2 small">
                — {rows.length} invoice{rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </h5>
          <div className="d-flex gap-1">
            <button
              className="btn btn-sm btn-outline-secondary"
              title="Refresh"
              onClick={handleRefresh}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise" />
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              title="Clear filters"
              onClick={handleAll}
            >
              All
            </button>
          </div>
        </div>

        {error && (
          <div className="card-body py-2">
            <div className="alert alert-danger py-2 small mb-0">{error}</div>
          </div>
        )}
        {!error && searched && !loading && rows.length === 0 && (
          <div className="card-body py-2">
            <p className="text-muted small mb-0">No invoices found for this period.</p>
          </div>
        )}

        <div className="table-responsive invoice-analysis-table-wrap" ref={tableRef}>
          <table className="table table-sm table-hover table-striped align-middle invoice-analysis-table mb-0">
            <thead>
              <tr className="loads-filter-row">
                <th className="text-center">#</th>
                <th className="text-center">Date</th>
                <th className="text-center">Loads</th>
                <th className="text-center">Actions</th>
                <th>
                  <label>Driver Name</label>
                  <select
                    className="form-select form-select-sm"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                  >
                    <option value="">All drivers</option>
                    {driverOptions.map((d) => (
                      <option key={d.id} value={d.id}>{d.full_name || d.label}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <label>Dispatcher</label>
                  <select
                    className="form-select form-select-sm"
                    value={dispatcherId}
                    onChange={(e) => setDispatcherId(e.target.value)}
                  >
                    <option value="">All dispatchers</option>
                    {dispatcherOptions.map((d) => (
                      <option key={d.id} value={d.id}>{d.label || d.full_name}</option>
                    ))}
                  </select>
                </th>
                <th>
                  <label>Carrier</label>
                  <select
                    className="form-select form-select-sm"
                    value={carrierId}
                    onChange={(e) => setCarrierId(e.target.value)}
                  >
                    <option value="">All carriers</option>
                    {carrierOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label || c.name}</option>
                    ))}
                  </select>
                </th>
                <th className="text-end">Net</th>
                <th className="text-end">Payment</th>
                {ACC_COLS.map(([field, header]) => (
                  <th key={field} className="text-end" style={{ whiteSpace: 'nowrap' }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9 + ACC_COLS.length} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm" />
                  </td>
                </tr>
              )}
              {!loading && rows.map((row, idx) => (
                <tr key={row.id}>
                  <td className="text-center text-muted">{idx + 1}</td>
                  <td className="text-center" style={{ whiteSpace: 'nowrap' }}>{row.date}</td>
                  <td className="text-center">
                    <span className="badge bg-success rounded-pill">{row.load_count}</span>
                  </td>
                  <td className="text-center">
                    <Link
                      to={`/accounting/invoices/drivers/${row.id}`}
                      className="btn btn-sm btn-outline-secondary py-0 px-1"
                      title="View invoice"
                    >
                      <i className="bi bi-file-earmark-text" />
                    </Link>
                  </td>
                  <td>{row.driver_name || <span className="text-muted">—</span>}</td>
                  <td>{row.dispatcher_names || <span className="text-muted">—</span>}</td>
                  <td>{row.carrier_name || <span className="text-muted">—</span>}</td>
                  <td className="text-end">{fmtMoney(row.net)}</td>
                  <td className="text-end">{fmtMoney(row.gross)}</td>
                  {ACC_COLS.map(([field, , isExpense]) => (
                    <td key={field} className="text-end">
                      {displayAccVal(row[field], isExpense)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="table-warning fw-bold">
                  <td colSpan={4} />
                  <td colSpan={3} className="text-end small text-muted fst-italic pe-3">Totals</td>
                  <td className="text-end">
                    <span className={totalNet < 0 ? 'text-danger' : ''}>
                      {totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-end">
                    <span className={totalGross < 0 ? 'text-danger' : ''}>
                      {totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  {ACC_COLS.map(([field, , isExpense]) => (
                    <td key={field} className="text-end">{sumCol(rows, field, isExpense)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
