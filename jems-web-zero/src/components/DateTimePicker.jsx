import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

export default function DateTimePicker({ value, onChange, required, className, id }) {
  const inputRef = useRef(null);
  const fpRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    fpRef.current = flatpickr(inputRef.current, {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      time_24hr: true,
      allowInput: false,
      disableMobile: true,
      onChange: ([date]) => {
        if (!date) { onChangeRef.current(''); return; }
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        onChangeRef.current(formatted);
      },
    });
    return () => fpRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!fpRef.current) return;
    if (value) {
      fpRef.current.setDate(value, false);
    } else {
      fpRef.current.clear();
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className || 'form-control form-control-sm'}
      readOnly
      required={required}
      placeholder="Select date & time..."
    />
  );
}
