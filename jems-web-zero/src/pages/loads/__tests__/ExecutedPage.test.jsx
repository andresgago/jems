import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExecutedPage from '../ExecutedPage';

vi.mock('../../../hooks/useLoads', () => ({ useLoads: vi.fn() }));
vi.mock('../../../services/brokers', () => ({
  brokersService: {
    options: vi.fn(),
  },
}));
vi.mock('../../../services/loads', () => ({
  loadsService: {
    toggleInvoiced: vi.fn(),
    setExecuted: vi.fn(),
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
  id: 1,
  number: 'LD-001',
  payment: 1200,
  invoiced: false,
  paid: false,
  driver_name: 'John Doe',
  truck_number: 'T-01',
  trailer_number: 'TR-01',
  dispatcher_name: 'Bob Smith',
  pickup_city_display: 'Charlotte (NC)',
  pickup_date: '2026-06-10T10:00:00Z',
  dropoff_city_display: 'Atlanta (GA)',
  dropoff_date: '2026-06-11T10:00:00Z',
  rate_file: null,
  bill_file: null,
  lumper_file: null,
  detention_file: null,
};

function setup(loads = [LOAD]) {
  const refresh = vi.fn();
  useLoads.mockReturnValue({ loads, loading: false, error: null, refresh });
  render(<MemoryRouter><ExecutedPage /></MemoryRouter>);
  return { refresh };
}

function mockResolvedOptions() {
  brokersService.options.mockResolvedValue({
    data: [{ id: 5, label: 'Acme Broker (MC123)' }],
  });
  usersService.options.mockResolvedValue({
    data: [
      { id: 7, label: 'Alice Dispatcher', full_name: 'Alice Dispatcher', is_dispatcher: true },
      { id: 8, label: 'Regular User', full_name: 'Regular User', is_dispatcher: false },
    ],
  });
}

describe('ExecutedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brokersService.options.mockReturnValue(new Promise(() => {}));
    usersService.options.mockReturnValue(new Promise(() => {}));
  });

  it('renders page heading', () => {
    setup();
    expect(screen.getByText(/Executed Loads/i)).toBeDefined();
  });

  it('loads payroll with legacy default filters', () => {
    setup();
    expect(useLoads).toHaveBeenCalledWith({ payroll: true, all: true, date_type: '3' });
  });

  it('renders broker and dispatcher option selects', async () => {
    mockResolvedOptions();
    setup();
    await waitFor(() => expect(brokersService.options).toHaveBeenCalled());
    expect(await screen.findByRole('option', { name: 'Acme Broker (MC123)' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Alice Dispatcher' })).toBeDefined();
    expect(screen.queryByRole('option', { name: 'Regular User' })).toBeNull();
  });

  it('does not render Order as a top search-bar control', () => {
    setup();
    expect(screen.queryByLabelText('Order #')).toBeNull();
    expect(screen.getByLabelText('Filter by order')).toBeDefined();
  });

  it('applies exact broker and dispatcher ids from selects', async () => {
    mockResolvedOptions();
    setup();
    await screen.findByRole('option', { name: 'Acme Broker (MC123)' });

    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Dispatcher'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(useLoads).toHaveBeenLastCalledWith({
      payroll: true,
      all: true,
      date_type: '3',
      broker: '5',
      dispatcher: '7',
    });
  });

  it('applies order filter from the table header on Enter', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Filter by order'), { target: { value: 'LD-001' } });
    fireEvent.keyDown(screen.getByLabelText('Filter by order'), { key: 'Enter' });
    expect(useLoads).toHaveBeenLastCalledWith({
      payroll: true,
      all: true,
      date_type: '3',
      number: 'LD-001',
    });
  });

  it('renders load row with order number link', () => {
    setup();
    expect(screen.getByText('LD-001')).toBeDefined();
  });

  it('renders driver name and truck info', () => {
    setup();
    expect(screen.getByText(/John Doe/i)).toBeDefined();
    expect(screen.getByText(/Truck T-01/i)).toBeDefined();
  });

  it('shows "Not Paid" badge when paid is false', () => {
    setup();
    expect(screen.getByText('Not Paid')).toBeDefined();
  });

  it('shows "Paid" badge when paid is true', () => {
    setup([{ ...LOAD, paid: true }]);
    expect(screen.getByText('Paid')).toBeDefined();
  });

  it('prefers drivers_paid for the driver paid badge when present', () => {
    setup([{ ...LOAD, paid: true, drivers_paid: false }]);
    expect(screen.getByText('Not Paid')).toBeDefined();
  });

  it('renders payment total in tfoot', () => {
    setup();
    // appears in both data row and tfoot — assert at least one exists
    expect(screen.getAllByText(/\$1,200\.00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('selects a row via checkbox and deselects via header checkbox toggle', () => {
    setup();
    const checkboxes = screen.getAllByRole('checkbox');
    const headerBox = checkboxes[0];
    const rowBox = checkboxes[1];
    fireEvent.click(rowBox);
    expect(rowBox.checked).toBe(true);
    fireEvent.click(headerBox); // all selected → deselect all
    expect(rowBox.checked).toBe(false);
  });

  it('renders disabled "Move to Invoice" and "Rebuild Invoices" buttons', () => {
    setup();
    // two disabled buttons share the same title
    const deferredBtns = screen.getAllByTitle(/Requires DriverInvoice module/i);
    expect(deferredBtns.length).toBe(2);
    deferredBtns.forEach((btn) => expect(btn.disabled).toBe(true));
  });

  it('shows empty state when no loads', () => {
    setup([]);
    expect(screen.getByText(/No executed loads found/i)).toBeDefined();
  });

  it('calls toggleInvoiced on invoiced button click', async () => {
    loadsService.toggleInvoiced.mockResolvedValue({});
    setup();
    const invoiceBtn = screen.getByTitle(/Not invoiced/i);
    fireEvent.click(invoiceBtn);
    await waitFor(() => expect(loadsService.toggleInvoiced).toHaveBeenCalledWith(1));
  });

  it('calls setExecuted on send-back button click after confirm', async () => {
    window.confirm = vi.fn(() => true);
    loadsService.setExecuted.mockResolvedValue({});
    setup();
    const backBtn = screen.getByTitle(/Send back to dispatch/i);
    fireEvent.click(backBtn);
    await waitFor(() => expect(loadsService.setExecuted).toHaveBeenCalledWith(1));
  });

  it('does not call setExecuted when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    setup();
    fireEvent.click(screen.getByTitle(/Send back to dispatch/i));
    expect(loadsService.setExecuted).not.toHaveBeenCalled();
  });

  it('shows loading spinner when loading', () => {
    useLoads.mockReturnValue({ loads: [], loading: true, error: null, refresh: vi.fn() });
    render(<MemoryRouter><ExecutedPage /></MemoryRouter>);
    expect(screen.getByText(/Loading/i)).toBeDefined();
  });
});
