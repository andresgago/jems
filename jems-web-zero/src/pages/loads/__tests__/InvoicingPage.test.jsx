import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoicingPage from '../InvoicingPage';

vi.mock('../../../hooks/useLoads', () => ({ useLoads: vi.fn() }));
vi.mock('../../../services/brokers', () => ({
  brokersService: {
    options: vi.fn(),
  },
}));
vi.mock('../../../services/loads', () => ({
  loadsService: {
    toggleInvoiced: vi.fn(),
    bulkInvoiced: vi.fn(),
  },
}));
vi.mock('../../../services/users', () => ({
  usersService: {
    options: vi.fn(),
  },
}));

import { useLoads } from '../../../hooks/useLoads';
import { brokersService } from '../../../services/brokers';
import { loadsService } from '../../../services/loads';
import { usersService } from '../../../services/users';

const LOAD = {
  id: 2,
  number: 'LD-002',
  payment: 900,
  miles: 300,
  weight: 10000,
  invoiced: false,
  broker_name: 'ACME Freight',
  broker_mc: 'MC-123',
  pickup_city_name: 'Miami',
  pickup_city_state: 'FL',
  pickup_city_zip: '33101',
  pickup_date: '2026-06-12T08:00:00Z',
  dropoff_city_name: 'Tampa',
  dropoff_city_state: 'FL',
  dropoff_city_zip: '33601',
  dropoff_date: '2026-06-12T18:00:00Z',
  rate_file: null,
  bill_file: null,
  lumper_file: null,
  detention_file: null,
};

function setup(loads = [LOAD]) {
  const refresh = vi.fn();
  useLoads.mockReturnValue({ loads, loading: false, error: null, refresh });
  render(<MemoryRouter><InvoicingPage /></MemoryRouter>);
  return { refresh };
}

function mockResolvedOptions() {
  brokersService.options.mockResolvedValue({
    data: [{ id: 5, label: 'ACME Freight (MC-123)' }],
  });
  usersService.options.mockResolvedValue({
    data: [
      { id: 7, label: 'Alice Dispatcher', full_name: 'Alice Dispatcher', is_dispatcher: true },
      { id: 8, label: 'Regular User', full_name: 'Regular User', is_dispatcher: false },
    ],
  });
}

describe('InvoicingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brokersService.options.mockReturnValue(new Promise(() => {}));
    usersService.options.mockReturnValue(new Promise(() => {}));
  });

  it('renders page heading', () => {
    setup();
    expect(screen.getByText(/Invoicing/i)).toBeDefined();
  });

  it('loads invoicing with legacy default date type', () => {
    setup();
    expect(useLoads).toHaveBeenCalledWith({
      execute: true,
      history: false,
      all: true,
      date_type: '3',
    });
  });

  it('renders broker and dispatcher option selects', async () => {
    mockResolvedOptions();
    setup();
    await waitFor(() => expect(brokersService.options).toHaveBeenCalled());
    expect(await screen.findByRole('option', { name: 'ACME Freight (MC-123)' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Alice Dispatcher' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Regular User' })).toBeNull();
  });

  it('applies exact broker, dispatcher, and order filters from the search band', async () => {
    mockResolvedOptions();
    setup();
    await screen.findByRole('option', { name: 'ACME Freight (MC-123)' });

    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Dispatcher'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Order #'), { target: { value: 'LD-002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(useLoads).toHaveBeenLastCalledWith({
      execute: true,
      history: false,
      all: true,
      date_type: '3',
      broker: '5',
      dispatcher: '7',
      number: 'LD-002',
    });
  });

  it('renders broker name and order number', () => {
    setup();
    expect(screen.getByText('ACME Freight')).toBeDefined();
    expect(screen.getByText('LD-002')).toBeDefined();
  });

  it('shows "Non-Invoiced" badge when invoiced is false', () => {
    setup();
    expect(screen.getByText('Non-Invoiced')).toBeDefined();
  });

  it('shows "Invoiced" badge when invoiced is true', () => {
    setup([{ ...LOAD, invoiced: true }]);
    expect(screen.getByText('Invoiced')).toBeDefined();
  });

  it('renders totals row with miles, weight, payment', () => {
    setup();
    // values appear in both data row and tfoot
    expect(screen.getAllByText('300.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\$900\.00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('"Set to Invoiced" button is disabled when no rows selected', () => {
    setup();
    const btn = screen.getByRole('button', { name: /Set to Invoiced/i });
    expect(btn.disabled).toBe(true);
  });

  it('selects all via header checkbox and enables bulk button', () => {
    setup();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // select all
    const btn = screen.getByRole('button', { name: /Set to Invoiced/i });
    expect(btn.disabled).toBe(false);
  });

  it('calls bulkInvoiced with selected ids after confirm', async () => {
    window.confirm = vi.fn(() => true);
    loadsService.bulkInvoiced.mockResolvedValue({});
    setup();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: /Set to Invoiced/i }));
    await waitFor(() => expect(loadsService.bulkInvoiced).toHaveBeenCalledWith([2]));
  });

  it('does not call bulkInvoiced when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    setup();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole('button', { name: /Set to Invoiced/i }));
    expect(loadsService.bulkInvoiced).not.toHaveBeenCalled();
  });

  it('calls toggleInvoiced on row action button click', async () => {
    loadsService.toggleInvoiced.mockResolvedValue({});
    setup();
    const toggleBtn = screen.getByTitle(/Not invoiced/i);
    fireEvent.click(toggleBtn);
    await waitFor(() => expect(loadsService.toggleInvoiced).toHaveBeenCalledWith(2));
  });

  it('shows empty state when no loads', () => {
    setup([]);
    expect(screen.getByText(/No executed loads found/i)).toBeDefined();
  });
});
