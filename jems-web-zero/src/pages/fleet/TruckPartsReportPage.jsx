import { useEffect, useRef, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import api from '../../services/api';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);

const DATE_OPTIONS = [
  { value: 1, label: 'By Dates' },
  { value: 3, label: 'Show All (Ignore Dates)' },
];

const PART_GROUPS = [
  { id: 1, label: 'Engine Type' },
  { id: 2, label: 'Cabin Type' },
  { id: 3, label: 'Transmission Type' },
];

const REPORT_OPTIONS = [
  { value: 1, label: 'Summary By Categories' },
  { value: 2, label: 'Listing By Categories' },
];

function MultiListbox({ id, label, options, selected, onChange, placeholder }) {
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
        title={placeholder}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      {selected.length > 0 && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 mt-1 text-secondary"
          onClick={() => onChange([])}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function CategoryAutocomplete({ selected, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  function search(q) {
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    api.get('/accounting/categories/search/', { params: { q } })
      .then(({ data }) => { setResults(data); setOpen(data.length > 0); })
      .catch(() => {});
  }

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 300);
  }

  function selectItem(item) {
    if (!selected.find((s) => s.id === item.id)) {
      onChange([...selected, item]);
    }
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function removeItem(id) {
    onChange(selected.filter((s) => s.id !== id));
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="fw-semibold small mb-1">Select Category</div>
      <input
        type="text"
        className="form-control form-control-sm"
        value={query}
        onChange={handleInput}
        placeholder="All Categories (write 3 letter minimum)"
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          className="list-group shadow"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
            maxHeight: '220px', overflowY: 'auto', marginTop: '2px',
          }}
        >
          {results.map((item) => (
            <li
              key={item.id}
              className="list-group-item list-group-item-action"
              style={{ cursor: 'pointer', fontSize: '13px', padding: '6px 10px' }}
              onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {selected.length > 0 && (
        <div className="mt-1 d-flex flex-wrap gap-1">
          {selected.map((s) => (
            <span key={s.id} className="badge bg-secondary d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
              {s.label}
              <button
                type="button"
                className="btn-close btn-close-white"
                style={{ width: '8px', height: '8px' }}
                onClick={() => removeItem(s.id)}
                aria-label={`Remove ${s.label}`}
              />
            </span>
          ))}
          <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={() => onChange([])}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default function TruckPartsReportPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [dateOption, setDateOption] = useState(1);
  const [report, setReport] = useState(1);

  const [selTrucks, setSelTrucks] = useState([]);
  const [selCategoryTypes, setSelCategoryTypes] = useState([]);
  const [selPartGroups, setSelPartGroups] = useState([]);
  const [selCategories, setSelCategories] = useState([]);

  const [truckOptions, setTruckOptions] = useState([]);
  const [categoryTypeOptions, setCategoryTypeOptions] = useState([]);

  useEffect(() => {
    api.get('/fleet/trucks/options/').then((r) => setTruckOptions(r.data)).catch(() => {});
    api.get('/accounting/category-types/').then((r) => {
      setCategoryTypeOptions(r.data.map((ct) => ({ id: ct.id, label: ct.name })));
    }).catch(() => {});
  }, []);

  function handleShowReport() {
    const params = new URLSearchParams();
    params.set('date_begin', start);
    params.set('date_end', end);
    params.set('date_option', dateOption);
    params.set('report', report);

    selTrucks.forEach((id) => params.append('truck', id));
    selCategoryTypes.forEach((id) => params.append('category_type', id));
    selPartGroups.forEach((id) => params.append('part_group', id));
    selCategories.forEach((c) => params.append('category', c.id));

    // Human-readable labels for the print header
    const truckMap = Object.fromEntries(truckOptions.map((t) => [t.id, t.number]));
    const ctMap = Object.fromEntries(categoryTypeOptions.map((ct) => [ct.id, ct.label]));
    const pgMap = Object.fromEntries(PART_GROUPS.map((pg) => [pg.id, pg.label]));

    selTrucks.forEach((id) => { if (truckMap[id]) params.append('truck_label', `#${truckMap[id]}`); });
    selCategoryTypes.forEach((id) => { if (ctMap[id]) params.append('category_type_label', ctMap[id]); });
    selPartGroups.forEach((id) => { if (pgMap[id]) params.append('part_group_label', pgMap[id]); });
    selCategories.forEach((c) => params.append('category_label', c.label));

    window.open(`/print/fleet/truck-parts?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Parts and Pieces Used By Trucks</h5>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="fw-semibold small mb-1 d-block">Filter by Dates</label>
          <DateRangePicker
            start={start}
            end={end}
            onApply={({ start: s, end: e }) => { setStart(s); setEnd(e); }}
          />
        </div>
        <div className="col-md-4">
          <div className="fw-semibold small mb-1">Date Options</div>
          <select
            className="form-select"
            style={{ minHeight: '48px' }}
            value={dateOption}
            onChange={(e) => setDateOption(Number(e.target.value))}
          >
            {DATE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <MultiListbox
            id="filter-trucks"
            label="Select Truck"
            options={truckOptions.map((t) => ({ id: t.id, label: `#${t.number}` }))}
            selected={selTrucks}
            onChange={setSelTrucks}
            placeholder="All Trucks (Summary)"
          />
        </div>
        <div className="col-md-4">
          <MultiListbox
            id="filter-category-types"
            label="Select Category Type"
            options={categoryTypeOptions}
            selected={selCategoryTypes}
            onChange={setSelCategoryTypes}
            placeholder="All Types"
          />
        </div>
        <div className="col-md-4">
          <MultiListbox
            id="filter-part-groups"
            label="Select Truck Part Group"
            options={PART_GROUPS}
            selected={selPartGroups}
            onChange={setSelPartGroups}
            placeholder="All Groups"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <CategoryAutocomplete selected={selCategories} onChange={setSelCategories} />
        </div>
        <div className="col-md-4">
          <div className="fw-semibold small mb-1">Report Options</div>
          <select
            className="form-select form-select-sm"
            value={report}
            onChange={(e) => setReport(Number(e.target.value))}
          >
            {REPORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <button className="btn btn-success" onClick={handleShowReport}>
            Show Report
          </button>
        </div>
      </div>
    </div>
  );
}
