import { useEffect, useMemo, useRef, useState } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

const pad = (value) => String(value).padStart(2, '0');

function formatDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function rangeLabel(start, end) {
  if (!start && !end) return 'Select date range';
  if (start && end) return `${start} ➤ ${end}`;
  return start || end;
}

const PRESETS = [
  {
    label: 'Today',
    range: () => {
      const today = new Date();
      return [today, today];
    },
  },
  {
    label: 'Yesterday',
    range: () => {
      const yesterday = addDays(new Date(), -1);
      return [yesterday, yesterday];
    },
  },
  {
    label: 'Last 7 days',
    range: () => {
      const today = new Date();
      return [addDays(today, -6), today];
    },
  },
  {
    label: 'Last 30 Days',
    range: () => {
      const today = new Date();
      return [addDays(today, -29), today];
    },
  },
];

export default function DateRangePicker({ start, end, onApply, className = '' }) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const onApplyRef = useRef(onApply);
  const pendingRef = useRef([parseDate(start), parseDate(end)]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState([parseDate(start), parseDate(end)]);
  const [activePreset, setActivePreset] = useState('');

  useEffect(() => { onApplyRef.current = onApply; }, [onApply]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);

  useEffect(() => {
    if (open) return;
    setPending([parseDate(start), parseDate(end)]);
  }, [start, end, open]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open || !inputRef.current || fpRef.current) return undefined;

    fpRef.current = flatpickr(inputRef.current, {
      mode: 'range',
      inline: true,
      showMonths: 2,
      dateFormat: 'Y-m-d',
      defaultDate: pendingRef.current.filter(Boolean),
      disableMobile: true,
      onChange: (dates) => {
        setActivePreset('');
        setPending([dates[0] || null, dates[1] || null]);
      },
    });

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!fpRef.current) return;
    fpRef.current.setDate(pending.filter(Boolean), false);
  }, [pending]);

  const pendingLabel = useMemo(
    () => rangeLabel(formatDate(pending[0]), formatDate(pending[1])),
    [pending],
  );

  const applyPreset = (preset) => {
    const range = preset.range();
    setActivePreset(preset.label);
    setPending(range);
  };

  const apply = () => {
    onApplyRef.current({
      start: formatDate(pending[0]),
      end: formatDate(pending[1] || pending[0]),
    });
    setOpen(false);
  };

  const cancel = () => {
    setPending([parseDate(start), parseDate(end)]);
    setOpen(false);
  };

  return (
    <div className={`date-range-picker ${className}`} ref={wrapperRef}>
      <button
        type="button"
        className={`date-range-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="date-range-icon"><i className="bi bi-calendar3" /></span>
        <span className="date-range-text">{rangeLabel(start, end)}</span>
      </button>

      {open && (
        <div className="date-range-popover">
          <div className="date-range-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={activePreset === preset.label ? 'active' : ''}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className={!activePreset ? 'active' : ''}
              onClick={() => setActivePreset('')}
            >
              Custom Range
            </button>
            <div className="date-range-actions">
              <button type="button" className="btn btn-success btn-sm" onClick={apply}>Apply</button>
              <button type="button" className="btn btn-info btn-sm text-white" onClick={cancel}>Cancel</button>
            </div>
          </div>
          <div className="date-range-calendar">
            <div className="date-range-manual">
              <div><i className="bi bi-calendar3 me-2" />{formatDate(pending[0]) || 'Start'}</div>
              <div><i className="bi bi-calendar3 me-2" />{formatDate(pending[1]) || 'End'}</div>
            </div>
            <input ref={inputRef} className="visually-hidden" readOnly aria-label="Date range calendar" />
            <div className="date-range-pending">{pendingLabel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
