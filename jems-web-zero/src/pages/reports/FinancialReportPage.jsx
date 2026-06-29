import { useEffect, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import api from '../../services/api';

function monthStart(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function monthEnd(d) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}
function weekStart(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}
function weekEnd(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  const sun = new Date(d.setDate(diff));
  return sun.toISOString().slice(0, 10);
}

const PERIOD_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'custom', label: 'Custom' },
];

function MultiListbox({ id, label, options, selected, onChange, labelKey = 'label', valueKey = 'id' }) {
  return (
    <div>
      <div className="fw-semibold small mb-1">{label}</div>
      <select
        id={id}
        className="form-select form-select-sm"
        multiple
        size={Math.min(options.length || 1, 6)}
        value={selected.map(String)}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
        style={{ minHeight: '72px' }}
      >
        {options.map((opt) => (
          <option key={opt[valueKey]} value={opt[valueKey]}>
            {opt[labelKey]}
          </option>
        ))}
      </select>
      {selected.length > 0 && (
        <button type="button" className="btn btn-link btn-sm p-0 mt-1 text-secondary"
          onClick={() => onChange([])}>
          Clear
        </button>
      )}
    </div>
  );
}

export default function FinancialReportPage() {
  const [carrier, setCarrier] = useState('');
  const [period, setPeriod] = useState('month');
  const [start, setStart] = useState(monthStart(new Date()));
  const [end, setEnd] = useState(monthEnd(new Date()));

  const [selDrivers, setSelDrivers] = useState([]);
  const [selTrucks, setSelTrucks] = useState([]);
  const [selTrailers, setSelTrailers] = useState([]);
  const [selDispatchers, setSelDispatchers] = useState([]);

  const [carrierOptions, setCarrierOptions] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const [truckOptions, setTruckOptions] = useState([]);
  const [trailerOptions, setTrailerOptions] = useState([]);
  const [dispatcherOptions, setDispatcherOptions] = useState([]);

  useEffect(() => {
    api.get('/carriers/options/').then((r) => setCarrierOptions(r.data)).catch(() => {});
    api.get('/drivers/options/').then((r) => setDriverOptions(r.data)).catch(() => {});
    api.get('/fleet/trucks/options/').then((r) => setTruckOptions(r.data)).catch(() => {});
    api.get('/fleet/trailers/options/').then((r) => setTrailerOptions(r.data)).catch(() => {});
    api.get('/users/options/', { params: { dispatchers: '1' } }).then((r) => setDispatcherOptions(r.data)).catch(() => {});
  }, []);

  function handlePeriodChange(value) {
    setPeriod(value);
    const now = new Date();
    if (value === 'month') {
      setStart(monthStart(now));
      setEnd(monthEnd(now));
    } else if (value === 'week') {
      setStart(weekStart(new Date(now)));
      setEnd(weekEnd(new Date(now)));
    }
  }

  function handleShowReport() {
    const params = new URLSearchParams();
    params.set('date_begin', start);
    params.set('date_end', end);
    params.set('period', period);
    if (carrier) params.set('carrier', carrier);
    selDrivers.forEach((id) => params.append('driver', id));
    selTrucks.forEach((id) => params.append('truck', id));
    selTrailers.forEach((id) => params.append('trailer', id));
    selDispatchers.forEach((id) => params.append('dispatcher', id));
    window.open(`/print/financial?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Profit and Loss</h5>

      <div className="row g-3 mb-3">
        <div className="col-md-5">
          <label htmlFor="filter-carrier" className="fw-semibold small mb-1 d-block">Carrier</label>
          <select
            id="filter-carrier"
            className="form-select"
            style={{ height: '48px' }}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            <option value="">Select a carrier</option>
            {carrierOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label htmlFor="filter-period" className="fw-semibold small mb-1 d-block">Period</label>
          <select
            id="filter-period"
            className="form-select"
            style={{ height: '48px' }}
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-5">
          <label className="fw-semibold small mb-1 d-block">Select date range</label>
          <DateRangePicker
            start={start}
            end={end}
            onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); setPeriod('custom'); }}
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <MultiListbox
            id="filter-drivers"
            label="Select Driver"
            options={driverOptions.map((d) => ({
              id: d.id,
              label: `${d.full_name}${d.carrier_name ? ` (${d.carrier_name})` : ''} [${d.status === 1 ? 'on' : 'off'}]`,
            }))}
            selected={selDrivers}
            onChange={setSelDrivers}
          />
        </div>
        <div className="col-md-3">
          <MultiListbox
            id="filter-trucks"
            label="Select Truck"
            options={truckOptions.map((t) => ({ id: t.id, label: `#${t.number}` }))}
            selected={selTrucks}
            onChange={setSelTrucks}
          />
        </div>
        <div className="col-md-3">
          <MultiListbox
            id="filter-trailers"
            label="Select Trailer"
            options={trailerOptions.map((t) => ({ id: t.id, label: `#${t.number}` }))}
            selected={selTrailers}
            onChange={setSelTrailers}
          />
        </div>
        <div className="col-md-3">
          <MultiListbox
            id="filter-dispatchers"
            label="Select Dispatcher"
            options={dispatcherOptions.map((u) => ({
              id: u.id,
              label: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            }))}
            selected={selDispatchers}
            onChange={setSelDispatchers}
          />
        </div>
      </div>

      <button className="btn btn-success" onClick={handleShowReport}>
        Show Report
      </button>
    </div>
  );
}
