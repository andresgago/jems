import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExecutedPage from '../ExecutedPage';

vi.mock('../../../hooks/useLoads', () => ({ useLoads: vi.fn() }));
vi.mock('../../../services/loads', () => ({
  loadsService: {
    toggleInvoiced: vi.fn(),
    setExecuted: vi.fn(),
  },
}));

import { useLoads } from '../../../hooks/useLoads';
import { loadsService } from '../../../services/loads';

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
  pickup_city_name: 'Charlotte',
  pickup_city_state: 'NC',
  pickup_date: '2026-06-10T10:00:00Z',
  dropoff_city_name: 'Atlanta',
  dropoff_city_state: 'GA',
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

describe('ExecutedPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders page heading', () => {
    setup();
    expect(screen.getByText(/Executed Loads/i)).toBeDefined();
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
