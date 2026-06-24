import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DateRangePicker from '../DateRangePicker';

vi.mock('flatpickr', () => {
  const instance = {
    setDate: vi.fn(),
    destroy: vi.fn(),
  };
  const flatpickr = vi.fn((_element, config) => {
    flatpickr._config = config;
    return instance;
  });
  flatpickr._instance = instance;
  flatpickr._config = null;
  return { default: flatpickr };
});

import flatpickr from 'flatpickr';

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 24, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an empty range label by default', () => {
    render(<DateRangePicker start="" end="" onApply={() => {}} />);

    expect(screen.getByRole('button', { name: /select date range/i })).toBeInTheDocument();
  });

  it('applies a custom selected range from the calendar', () => {
    const onApply = vi.fn();
    render(<DateRangePicker start="" end="" onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: /select date range/i }));
    act(() => {
      flatpickr._config.onChange([new Date(2026, 5, 17), new Date(2026, 5, 24)]);
    });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({ start: '2026-06-17', end: '2026-06-24' });
  });

  it('uses the selected single date as both start and end', () => {
    const onApply = vi.fn();
    render(<DateRangePicker start="" end="" onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: /select date range/i }));
    act(() => {
      flatpickr._config.onChange([new Date(2026, 5, 24)]);
    });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({ start: '2026-06-24', end: '2026-06-24' });
  });

  it('applies preset ranges relative to today', () => {
    const onApply = vi.fn();
    render(<DateRangePicker start="" end="" onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: /select date range/i }));
    fireEvent.click(screen.getByRole('button', { name: /last 7 days/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(onApply).toHaveBeenCalledWith({ start: '2026-06-18', end: '2026-06-24' });
  });

  it('cancels pending changes without applying them', () => {
    const onApply = vi.fn();
    render(<DateRangePicker start="2026-06-01" end="2026-06-02" onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: /2026-06-01/i }));
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /2026-06-01.*2026-06-02/i })).toBeInTheDocument();
  });
});
