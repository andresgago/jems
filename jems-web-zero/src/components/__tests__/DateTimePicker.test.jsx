import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DateTimePicker from '../DateTimePicker'

vi.mock('flatpickr', () => {
  const instance = {
    setDate: vi.fn(),
    clear: vi.fn(),
    destroy: vi.fn(),
  };
  const flatpickr = vi.fn(() => instance);
  flatpickr._instance = instance;
  return { default: flatpickr };
});

import flatpickr from 'flatpickr';

describe('DateTimePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a text input', () => {
    render(<DateTimePicker value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('input is read-only', () => {
    render(<DateTimePicker value="" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  })

  it('applies required attribute when required prop is set', () => {
    render(<DateTimePicker value="" onChange={() => {}} required />)
    expect(screen.getByRole('textbox')).toBeRequired()
  })

  it('applies custom className', () => {
    render(<DateTimePicker value="" onChange={() => {}} className="form-control is-invalid" />)
    expect(screen.getByRole('textbox')).toHaveClass('form-control', 'is-invalid')
  })

  it('initializes flatpickr with time enabled and 24h format', () => {
    render(<DateTimePicker value="" onChange={() => {}} />)
    expect(flatpickr).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ enableTime: true, time_24hr: true })
    )
  })

  it('calls setDate when value is provided', () => {
    render(<DateTimePicker value="2026-06-23 14:30" onChange={() => {}} />)
    expect(flatpickr._instance.setDate).toHaveBeenCalledWith('2026-06-23 14:30', false)
  })

  it('calls clear when value is empty', () => {
    render(<DateTimePicker value="" onChange={() => {}} />)
    expect(flatpickr._instance.clear).toHaveBeenCalled()
  })
})
