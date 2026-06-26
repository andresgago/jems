import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentsPage from '../PaymentsPage';

vi.mock('../../../hooks/useLoads', () => ({ useLoads: vi.fn() }));
vi.mock('../../../services/drivers', () => ({
  driversService: {
    list: vi.fn(),
  },
}));
vi.mock('../../../services/loads', () => ({
  loadsService: {
    togglePaid: vi.fn(),
    bulkPaid: vi.fn(),
  },
}));
vi.mock('../../../services/users', () => ({
  usersService: {
    options: vi.fn(),
  },
}));

import { useLoads } from '../../../hooks/useLoads';
import { driversService } from '../../../services/drivers';
import { loadsService } from '../../../services/loads';
import { usersService } from '../../../services/users';

const LOAD = {
  id: 3,
  number: 'LD-003',
  payment: 2000,
  miles: 500,
  weight: 20000,
  paid: false,
  driver_name: 'Maria Lopez',
  truck_number: 'T-05',
  trailer_number: 'TR-05',
  pickup_city_name: 'Dallas',
  pickup_city_state: 'TX',
  pickup_city_zip: '75201',
  pickup_date: '2026-06-15T07:00:00Z',
  dropoff_city_name: 'Houston',
  dropoff_city_state: 'TX',
  dropoff_city_zip: '77001',
  dropoff_date: '2026-06-15T15:00:00Z',
  rate_file: null,
  bill_file: null,
  lumper_file: null,
  detention_file: null,
};

function setup(loads = [LOAD]) {
  const refresh = vi.fn();
  useLoads.mockReturnValue({ loads, loading: false, error: null, refresh });
  render(<MemoryRouter><PaymentsPage /></MemoryRouter>);
  return { refresh };
}

function mockResolvedOptions() {
  driversService.list.mockResolvedValue({
    data: [{ id: 9, first_name: 'Maria', last_name: 'Lopez', full_name: 'Maria Lopez' }],
  });
  usersService.options.mockResolvedValue({
    data: [
      { id: 7, label: 'Alice Dispatcher', full_name: 'Alice Dispatcher', is_dispatcher: true },
      { id: 8, label: 'Regular User', full_name: 'Regular User', is_dispatcher: false },
    ],
  });
}

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driversService.list.mockReturnValue(new Promise(() => {}));
    usersService.options.mockReturnValue(new Promise(() => {}));
  });

  it('renders page heading', () => {
    setup();
    expect(screen.getByText(/Payments/i)).toBeDefined();
  });

  it('loads payments with legacy default date type', () => {
    setup();
    expect(useLoads).toHaveBeenCalledWith({
      execute: true,
      history: false,
      all: true,
      date_type: '3',
    });
  });

  it('renders driver and dispatcher option selects', async () => {
    mockResolvedOptions();
    setup();
    await waitFor(() => expect(driversService.list).toHaveBeenCalled());
    expect(await screen.findByRole('option', { name: 'Maria Lopez' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Alice Dispatcher' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Regular User' })).toBeNull();
  });

  it('applies exact driver, dispatcher, and order filters from the search band', async () => {
    mockResolvedOptions();
    setup();
    await screen.findByRole('option', { name: 'Maria Lopez' });

    fireEvent.change(screen.getByLabelText('Driver'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Dispatcher'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Order #'), { target: { value: 'LD-003' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(useLoads).toHaveBeenLastCalledWith({
      execute: true,
      history: false,
      all: true,
      date_type: '3',
      driver: '9',
      dispatcher: '7',
      number: 'LD-003',
    });
  });

  it('renders driver name and order number', () => {
    setup();
    expect(screen.getByText(/Maria Lopez/i)).toBeDefined();
    expect(screen.getByText('LD-003')).toBeDefined();
  });

  it('shows "Non-Paid" badge when paid is false', () => {
    setup();
    expect(screen.getByText('Non-Paid')).toBeDefined();
  });

  it('shows "Paid" badge when paid is true', () => {
    setup([{ ...LOAD, paid: true }]);
    // "Paid" also appears in the <th> header, so find the badge span specifically
    const badges = screen.getAllByText('Paid');
    expect(badges.some((el) => el.tagName === 'SPAN')).toBe(true);
  });

  it('renders totals row with miles, weight, payment', () => {
    setup();
    // values appear in both data row and tfoot
    expect(screen.getAllByText('500.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('20000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$2,000\.00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('"Set to Paid" button is disabled when no rows selected', () => {
    setup();
    const btn = screen.getByRole('button', { name: /Set to Paid/i });
    expect(btn.disabled).toBe(true);
  });

  it('selects all via header checkbox and enables bulk button', () => {
    setup();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /Set to Paid/i }).disabled).toBe(false);
  });

  it('calls bulkPaid with selected ids after confirm', async () => {
    window.confirm = vi.fn(() => true);
    loadsService.bulkPaid.mockResolvedValue({});
    setup();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Set to Paid/i }));
    await waitFor(() => expect(loadsService.bulkPaid).toHaveBeenCalledWith([3]));
  });

  it('does not call bulkPaid when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    setup();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Set to Paid/i }));
    expect(loadsService.bulkPaid).not.toHaveBeenCalled();
  });

  it('calls togglePaid on row action button click', async () => {
    loadsService.togglePaid.mockResolvedValue({});
    setup();
    fireEvent.click(screen.getByTitle(/Not paid/i));
    await waitFor(() => expect(loadsService.togglePaid).toHaveBeenCalledWith(3));
  });

  it('renders disabled "Pay the Driver" button', () => {
    setup();
    expect(screen.getByTitle(/Requires DriverInvoice module/i)).toBeDefined();
  });

  it('shows empty state when no loads', () => {
    setup([]);
    expect(screen.getByText(/No executed loads found/i)).toBeDefined();
  });
});
