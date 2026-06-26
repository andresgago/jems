import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '../HistoryPage';

vi.mock('../../../hooks/useLoads', () => ({ useLoads: vi.fn() }));
vi.mock('../../../services/brokers', () => ({
  brokersService: {
    options: vi.fn(),
  },
}));
vi.mock('../../../services/drivers', () => ({
  driversService: {
    list: vi.fn(),
  },
}));
vi.mock('../../../services/loads', () => ({
  loadsService: {
    setHistory: vi.fn(),
  },
}));

import { useLoads } from '../../../hooks/useLoads';
import { brokersService } from '../../../services/brokers';
import { driversService } from '../../../services/drivers';
import { loadsService } from '../../../services/loads';

const LOAD = {
  id: 4,
  number: 'LD-004',
  payment: 1500,
  status: 3,
  invoiced: true,
  paid: false,
  broker_name: 'Global Shipping',
  broker_mc: 'MC-456',
  driver_name: 'Carlos Perez',
  truck_number: 'T-10',
  trailer_number: 'TR-10',
  pickup_city_name: 'New York',
  pickup_city_state: 'NY',
  pickup_city_zip: '10001',
  pickup_date: '2026-05-01T09:00:00Z',
  dropoff_city_name: 'Boston',
  dropoff_city_state: 'MA',
  dropoff_city_zip: '02101',
  dropoff_date: '2026-05-02T09:00:00Z',
  rate_file: null,
  bill_file: null,
  lumper_file: null,
  detention_file: null,
};

function setup(loads = [LOAD]) {
  const refresh = vi.fn();
  useLoads.mockReturnValue({ loads, loading: false, error: null, refresh });
  render(<MemoryRouter><HistoryPage /></MemoryRouter>);
  return { refresh };
}

function mockResolvedOptions() {
  brokersService.options.mockResolvedValue({
    data: [{ id: 5, label: 'Global Shipping (MC-456)' }],
  });
  driversService.list.mockResolvedValue({
    data: [{ id: 9, first_name: 'Carlos', last_name: 'Perez', full_name: 'Carlos Perez' }],
  });
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brokersService.options.mockReturnValue(new Promise(() => {}));
    driversService.list.mockReturnValue(new Promise(() => {}));
  });

  it('renders page heading', () => {
    setup();
    expect(screen.getByText(/Load History/i)).toBeDefined();
  });

  it('loads history search empty by default to mirror legacy initial state', () => {
    setup();
    expect(useLoads).toHaveBeenCalledWith({ history_search: true, all: true });
  });

  it('renders broker and driver option selects', async () => {
    mockResolvedOptions();
    setup();
    await waitFor(() => expect(brokersService.options).toHaveBeenCalled());
    expect(await screen.findByRole('option', { name: 'Global Shipping (MC-456)' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Carlos Perez' })).toBeDefined();
  });

  it('applies payroll-style history filters with exact ids and order number', async () => {
    mockResolvedOptions();
    setup();
    await screen.findByRole('option', { name: 'Global Shipping (MC-456)' });

    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Driver'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Order #'), { target: { value: 'LD-004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(useLoads).toHaveBeenLastCalledWith({
      history_search: true,
      all: true,
      date_type: '3',
      broker: '5',
      driver: '9',
      number: 'LD-004',
    });
  });

  it('renders broker name and order number', () => {
    setup();
    expect(screen.getByText(/Global Shipping/i)).toBeDefined();
    expect(screen.getByText('LD-004')).toBeDefined();
  });

  it('renders driver and truck/trailer columns', () => {
    setup();
    expect(screen.getByText(/Carlos Perez/i)).toBeDefined();
    expect(screen.getByText(/T-10/i)).toBeDefined();
    expect(screen.getByText(/TR-10/i)).toBeDefined();
  });

  it('shows invoiced checkmark icon for invoiced load', () => {
    setup();
    const invoicedIcon = document.querySelector('.bi-check-square-fill.text-success');
    expect(invoicedIcon).not.toBeNull();
  });

  it('shows unchecked icon for non-paid load', () => {
    setup();
    const paidIcon = document.querySelector('.bi-square.text-muted');
    expect(paidIcon).not.toBeNull();
  });

  it('shows cancelled icon when status is 5', () => {
    setup([{ ...LOAD, status: 5 }]);
    const cancelIcon = document.querySelector('.bi-x-circle-fill.text-danger');
    expect(cancelIcon).not.toBeNull();
  });

  it('does NOT show cancelled icon for non-cancelled status', () => {
    setup();
    const cancelIcon = document.querySelector('.bi-x-circle-fill.text-danger');
    expect(cancelIcon).toBeNull();
  });

  it('has no checkboxes (read-only, no bulk actions)', () => {
    setup();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('renders send-back button (un-history action)', () => {
    setup();
    expect(screen.getByTitle(/Send back to executed queue/i)).toBeDefined();
  });

  it('calls setHistory on send-back after confirm', async () => {
    window.confirm = vi.fn(() => true);
    loadsService.setHistory.mockResolvedValue({});
    setup();
    fireEvent.click(screen.getByTitle(/Send back to executed queue/i));
    await waitFor(() => expect(loadsService.setHistory).toHaveBeenCalledWith(4));
  });

  it('does not call setHistory when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    setup();
    fireEvent.click(screen.getByTitle(/Send back to executed queue/i));
    expect(loadsService.setHistory).not.toHaveBeenCalled();
  });

  it('shows empty state when no loads', () => {
    setup([]);
    expect(screen.getByText(/No history loads found/i)).toBeDefined();
  });

  it('shows loading spinner when loading', () => {
    useLoads.mockReturnValue({ loads: [], loading: true, error: null, refresh: vi.fn() });
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    expect(screen.getByText(/Loading/i)).toBeDefined();
  });

  it('renders broker MC number below broker name', () => {
    setup();
    expect(screen.getByText('(MC-456)')).toBeDefined();
  });
});
