import { useEffect, useRef, useState } from 'react';
import DateRangePicker from '../../components/DateRangePicker';
import api from '../../services/api';

const today = new Date();
const defaultEnd = today.toISOString().slice(0, 10);
const defaultStart = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);

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

function CategoryAutocomplete({ selected, onChange, placeholder }) {
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
        placeholder={placeholder || 'All Categories (write 3 letter minimum)'}
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
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-secondary"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default function CategoryTrackingReportPage() {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const [selTrucks, setSelTrucks] = useState([]);
  const [selTrailers, setSelTrailers] = useState([]);
  const [selCategories, setSelCategories] = useState([]);
  const [selPositions, setSelPositions] = useState([]);

  const [truckOptions, setTruckOptions] = useState([]);
  const [trailerOptions, setTrailerOptions] = useState([]);
  const [positionOptions, setPositionOptions] = useState([]);

  useEffect(() => {
    api.get('/fleet/trucks/options/').then((r) => setTruckOptions(r.data)).catch(() => {});
    api.get('/fleet/trailers/options/').then((r) => setTrailerOptions(r.data)).catch(() => {});
    api.get('/users/positions/options/').then((r) => setPositionOptions(r.data)).catch(() => {});
  }, []);

  function handleShowReport() {
    const params = new URLSearchParams();
    params.set('date_begin', start);
    params.set('date_end', end);
    selTrucks.forEach((id) => params.append('truck', id));
    selTrailers.forEach((id) => params.append('trailer', id));
    selCategories.forEach((c) => params.append('category', c.id));
    selPositions.forEach((id) => params.append('position', id));

    const truckMap = Object.fromEntries(
      truckOptions.map((t) => [t.id, t.number || String(t.id)])
    );
    const trailerMap = Object.fromEntries(
      trailerOptions.map((t) => [t.id, t.number || String(t.id)])
    );
    const positionMap = Object.fromEntries(
      positionOptions.map((p) => [p.id, p.name])
    );

    selTrucks.forEach((id) => {
      if (truckMap[id]) params.append('truck_label', `#${truckMap[id]}`);
    });
    selTrailers.forEach((id) => {
      if (trailerMap[id]) params.append('trailer_label', `#${trailerMap[id]}`);
    });
    selCategories.forEach((c) => params.append('category_label', c.label));
    selPositions.forEach((id) => {
      if (positionMap[id]) params.append('position_label', positionMap[id]);
    });

    window.open(`/print/category-tracking?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <h5 className="mb-3">Category Tracking</h5>

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
          <MultiListbox
            id="filter-trucks"
            label="Select Truck"
            options={truckOptions.map((t) => ({ id: t.id, label: `#${t.number}` }))}
            selected={selTrucks}
            onChange={setSelTrucks}
            placeholder="All Trucks"
          />
        </div>
        <div className="col-md-4">
          <MultiListbox
            id="filter-trailers"
            label="Select Trailer"
            options={trailerOptions.map((t) => ({ id: t.id, label: `#${t.number}` }))}
            selected={selTrailers}
            onChange={setSelTrailers}
            placeholder="All Trailers"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4" />
        <div className="col-md-4">
          <CategoryAutocomplete
            selected={selCategories}
            onChange={setSelCategories}
            placeholder="All Categories (write 3 letter minimum)"
          />
        </div>
        <div className="col-md-4">
          <MultiListbox
            id="filter-positions"
            label="Select Position"
            options={positionOptions.map((p) => ({ id: p.id, label: p.name }))}
            selected={selPositions}
            onChange={setSelPositions}
            placeholder="All Positions"
          />
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
