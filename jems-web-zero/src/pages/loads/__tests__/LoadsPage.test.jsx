import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoadsPage from '../LoadsPage';

vi.mock('../../../hooks/useLoads', () => ({
  useLoads: vi.fn(),
}));

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../services/loads', async () => {
  const actual = await vi.importActual('../../../services/loads');
  return {
    ...actual,
    loadsService: {
      setStatus: vi.fn(),
      setHistory: vi.fn(),
      destroy: vi.fn(),
      bulkDelete: vi.fn(),
      setExecuted: vi.fn(),
    },
  };
});

vi.mock('../../../services/users', async () => {
  const actual = await vi.importActual('../../../services/users');
  return {
    ...actual,
    usersService: {
      options: vi.fn(),
    },
  };
});

vi.mock('../../../services/brokers', async () => {
  const actual = await vi.importActual('../../../services/brokers');
  return { ...actual, brokersService: { options: vi.fn(), search: vi.fn() } };
});

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers');
  return { ...actual, driversService: { list: vi.fn() } };
});

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks');
  return { ...actual, trucksService: { list: vi.fn() } };
});

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers');
  return { ...actual, trailersService: { options: vi.fn() } };
});

vi.mock('../../../services/rtl', async () => {
  const actual = await vi.importActual('../../../services/rtl');
  return { ...actual, rtlService: { fetchAndSync: vi.fn() } };
});

vi.mock('../AssignLoadModal', () => ({
  default: ({ load, onClose }) => (
    <div data-testid="assign-modal">
      <span>AssignModal: {load.number}</span>
      <button onClick={onClose}>CloseModal</button>
    </div>
  ),
}));

vi.mock('../RateLoadModal', () => ({
  default: ({ load, onClose }) => (
    <div data-testid="rate-modal">
      <span>RateModal: {load.number}</span>
      <button onClick={onClose}>CloseRateModal</button>
    </div>
  ),
}));

import { useLoads } from '../../../hooks/useLoads';
import { useAuth } from '../../../contexts/useAuth';
import { usersService } from '../../../services/users';
import { brokersService } from '../../../services/brokers';
import { driversService } from '../../../services/drivers';
import { loadsService } from '../../../services/loads';
import { rtlService } from '../../../services/rtl';

const dispatchers = [
  { id: 17, label: 'Beatriz Gago Alonso', full_name: 'Beatriz Gago Alonso', is_dispatcher: true },
  { id: 18, label: 'Gago Test', full_name: 'Gago Test', is_dispatcher: true },
  { id: 19, label: 'Jorge Nunez Silveira', full_name: 'Jorge Nunez Silveira', is_dispatcher: true },
  { id: 20, label: 'Regular User', full_name: 'Regular User', is_dispatcher: false },
];

const rows = [
  {
    id: 1,
    number: 'LD-001',
    payment: 1500,
    status: 1,
    broker: 10,
    broker_name: 'Local Jobee',
    broker_denied: true,
    broker_debtor_buy_status: 'No Buy - Denied For Purchases',
    carrier_name: 'JOBEE EXPRESS LLC',
    pickup_city_display: 'Pineville (NC)',
    pickup_city_zip: '28134',
    pickup_date: '2026-06-17T10:00:00Z',
    dropoff_city_display: 'Pineville (NC)',
    dropoff_city_zip: '28134',
    dropoff_date: '2026-06-18T10:00:00Z',
    driver: 4,
    driver_name: 'Alain Reynier',
    driver_code: '0149',
    driver_rtl_event_code: null,
    driver_rtl_id: null,
    driver_rtl_has_violations: false,
    truck_number: '4268',
    trailer_number: 'J534242',
    trailer_type_short_name: 'V',
    load_trailer_type_short_name: 'V',
    rate_file: '/media/rate.pdf',
    bill_file: '/media/bill.pdf',
    assignment_complete: true,
    ready_to_execute: true,
    execute: false,
    is_drop: false,
    drop_place: null,
    days_in_drop: 0,
    shipper_rating: 5,
    receiver_rating: 5,
    invoiced: false,
    paid: true,
  },
];

function mockLoadsReturn(overrides = {}) {
  useLoads.mockReturnValue({
    loads: rows,
    count: rows.length,
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({
    user: { user_id: 17, full_name: 'Beatriz Gago Alonso', roles: ['dispatcher'] },
  });
  usersService.options.mockResolvedValue({ data: dispatchers });
  brokersService.options.mockResolvedValue({ data: [] });
  brokersService.search.mockResolvedValue({ data: [] });
  driversService.list.mockResolvedValue({ data: [] });
  mockLoadsReturn();
});

describe('LoadsPage', () => {
  it('marks denied brokers with the TMS denied styling', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const broker = screen.getByRole('link', { name: /Local Jobee/i });
    expect(broker).toHaveClass('broker-denied');
    expect(broker).toHaveAttribute('title', 'No Buy - Denied For Purchases');
  });

  it('applies column filters through useLoads params', async () => {
    brokersService.options.mockResolvedValue({ data: [{ id: 5, label: 'Jobee Express (123456)' }] });
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Broker' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jobee Express (123456)' }));

    await waitFor(() => {
      expect(useLoads).toHaveBeenLastCalledWith(expect.objectContaining({ broker: '5' }));
    });
  });

  it('offers all, mine, and other dispatchers in the dispatcher dropdown', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /All dispatchers/i }));

    expect(await screen.findByText('Beatriz Gago Alonso')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^My loads$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Gago Test$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Jorge Nunez Silveira$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Regular User$/i })).not.toBeInTheDocument();
    expect(screen.queryAllByText('Beatriz Gago Alonso')).toHaveLength(1);
  });

  it('updates the loads title for a selected dispatcher scope', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /All dispatchers/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Gago Test$/i }));

    expect(await screen.findByRole('heading', { name: /Gago Test Loads/i })).toBeInTheDocument();
  });

  it('toggles All rows without clearing the applied dispatcher filter', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /All dispatchers/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Gago Test$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }));

    await waitFor(() => {
      expect(useLoads).toHaveBeenLastCalledWith(expect.objectContaining({ dispatcher: '18', all: true }));
    });
    expect(useLoads.mock.calls.at(-1)[0]).not.toHaveProperty('page');
  });

  it('switches the grid counter between Showing and Total copy', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByText('Showing 1-1 of 1 item.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^All$/i }));

    expect(screen.getByText('Total 1 item.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Page$/i })).toBeInTheDocument();
  });

  it('returns from All mode to paged mode without changing the applied filters', async () => {
    brokersService.options.mockResolvedValue({ data: [{ id: 7, label: 'Local Broker (654321)' }] });
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Broker' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Local Broker (654321)' }));
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Page$/i }));

    await waitFor(() => {
      expect(useLoads).toHaveBeenLastCalledWith(expect.objectContaining({ broker: '7', page: 1, page_size: 25 }));
    });
    expect(useLoads.mock.calls.at(-1)[0]).not.toHaveProperty('all');
  });

  it('keeps filters when moving to the next page', async () => {
    driversService.list.mockResolvedValue({ data: [{ id: 4, full_name: 'Alain Reynier' }] });
    mockLoadsReturn({ count: 52 });
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Driver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alain Reynier' }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => {
      expect(useLoads).toHaveBeenLastCalledWith(expect.objectContaining({ driver: '4', page: 2, page_size: 25 }));
    });
  });

  it('Reset Grid clears the visible table until Search is pressed again', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByRole('link', { name: /Local Jobee/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reset Grid/i }));

    expect(screen.queryByRole('link', { name: /Local Jobee/i })).not.toBeInTheDocument();
    expect(screen.getByText('No loads found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    expect(screen.getByRole('link', { name: /Local Jobee/i })).toBeInTheDocument();
  });

  it('shows Total 0 items when All mode has no matching rows', async () => {
    mockLoadsReturn({ loads: [], count: 0 });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }));

    expect(screen.getByText('Total 0 items.')).toBeInTheDocument();
    expect(screen.getByText('No loads found.')).toBeInTheDocument();
  });

  it('shows "List all loads" button when dispatcher is auto-scoped to current user', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^List all loads$/i })).toBeInTheDocument();
    });
  });

  it('"List all loads" changes button label to "List only my loads"', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^List all loads$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^List all loads$/i }));

    expect(screen.getByRole('button', { name: /^List only my loads$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^List all loads$/i })).not.toBeInTheDocument();
  });

  it('"List all loads" removes dispatcher from useLoads params and updates heading', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^List all loads$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^List all loads$/i }));

    await waitFor(() => {
      const lastCall = useLoads.mock.calls.at(-1)[0];
      expect(lastCall).not.toHaveProperty('dispatcher');
    });

    expect(await screen.findByRole('heading', { name: /All Loads/i })).toBeInTheDocument();
  });

  it('"List only my loads" restores dispatcher filter to current user', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^List all loads$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^List all loads$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^List only my loads$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^List only my loads$/i }));

    await waitFor(() => {
      expect(useLoads).toHaveBeenLastCalledWith(expect.objectContaining({ dispatcher: '17' }));
    });

    expect(screen.getByRole('button', { name: /^List all loads$/i })).toBeInTheDocument();
  });

  it('shows driver code in parentheses when driver_code is present', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByText('(0149)')).toBeInTheDocument();
  });

  it('does not show ELD badge when driver_rtl_event_code is null', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.queryByText('Driving')).not.toBeInTheDocument();
    expect(screen.queryByText('Sleeper')).not.toBeInTheDocument();
  });

  it('shows ELD badge with correct label when driver has RTL status and load is started', async () => {
    const now = new Date();
    const puDate = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const dropDate = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();
    mockLoadsReturn({
      loads: [{ ...rows[0], driver_rtl_event_code: 'DS_SB', status: 2, pickup_date: puDate, dropoff_date: dropDate }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByText('Sleeper')).toBeInTheDocument();
  });

  it('does not show ELD badge when load is outside the active window', async () => {
    mockLoadsReturn({
      loads: [{ ...rows[0], driver_rtl_event_code: 'DS_D', status: 3, pickup_date: '2020-01-01T00:00:00Z', dropoff_date: '2020-01-02T00:00:00Z' }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.queryByText('Driving')).not.toBeInTheDocument();
  });

  it('renders ELD badge as a link to RTL driver detail when driver_rtl_id is set', async () => {
    const now = new Date();
    const puDate = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const dropDate = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();
    mockLoadsReturn({
      loads: [{ ...rows[0], driver_rtl_event_code: 'DS_D', driver_rtl_id: 42, driver_rtl_has_violations: false, status: 2, pickup_date: puDate, dropoff_date: dropDate }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const badge = screen.getByText('Driving');
    expect(badge.tagName).toBe('A');
    expect(badge.getAttribute('href')).toBe('/integrations/rtl/drivers/42');
  });

  it('renders ELD badge as a span (not a link) when driver_rtl_id is null', async () => {
    const now = new Date();
    const puDate = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const dropDate = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();
    mockLoadsReturn({
      loads: [{ ...rows[0], driver_rtl_event_code: 'DS_ON', driver_rtl_id: null, driver_rtl_has_violations: false, status: 2, pickup_date: puDate, dropoff_date: dropDate }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const badge = screen.getByText('On Duty');
    expect(badge.tagName).toBe('SPAN');
  });

  it('renders ELD badge with danger class when driver_rtl_has_violations is true', async () => {
    const now = new Date();
    const puDate = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
    const dropDate = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();
    mockLoadsReturn({
      loads: [{ ...rows[0], driver_rtl_event_code: 'DS_D', driver_rtl_id: 7, driver_rtl_has_violations: true, status: 2, pickup_date: puDate, dropoff_date: dropDate }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const badge = screen.getByText('Driving');
    expect(badge.className).toMatch(/bg-danger/);
  });

  it('shows drop indicator on dropoff city when is_drop=true', async () => {
    mockLoadsReturn({
      loads: [{ ...rows[0], is_drop: true, drop_place: 50, days_in_drop: 3 }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByTitle('Trailer Drop Here')).toBeInTheDocument();
    expect(screen.getByText('(3d)')).toBeInTheDocument();
  });

  it('does not show drop indicator when is_drop=false', async () => {
    mockLoadsReturn({
      loads: [{ ...rows[0], is_drop: false, days_in_drop: 3 }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.queryByTitle('Trailer Drop Here')).not.toBeInTheDocument();
  });

  it('shows the Status dropdown for non-detention loads', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /^Status$/i })).toBeEnabled();
  });

  it('shows only the legacy Status dropdown items for registered loads', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Delivered/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark as Detention/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Load/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Move to History/i })).not.toBeInTheDocument();
  });

  it('keeps Delivered visible for finished loads like the legacy grid', async () => {
    mockLoadsReturn({
      loads: [{ ...rows[0], status: 3 }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Delivered/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark as Detention/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Load/i })).not.toBeInTheDocument();
  });

  it('hides the Status dropdown for detention loads instead of disabling it', async () => {
    mockLoadsReturn({
      loads: [{ ...rows[0], status: 4 }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: /^Status$/i })).not.toBeInTheDocument();
    expect(screen.getByText('Detention').closest('tr')).toHaveClass('row-detention');
  });

  it('assignment cell is a button that opens assign modal', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const assignBtn = screen.getByRole('button', { name: 'Assign truck, trailer and driver' });
    expect(assignBtn).toBeInTheDocument();
    expect(assignBtn.tagName).toBe('BUTTON');
  });

  it('rating star cell is a button that opens rate modal', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const rateBtn = screen.getByRole('button', { name: 'Set load ratings' });
    expect(rateBtn).toBeInTheDocument();
    fireEvent.click(rateBtn);
    expect(screen.getByTestId('rate-modal')).toBeInTheDocument();
  });

  it('shows execute button when ready_to_execute=true and execute=false', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: 'Send load to executed' })).toBeInTheDocument();
  });

  it('calls loadsService.setExecuted when execute button is clicked', async () => {
    loadsService.setExecuted.mockResolvedValue({ data: {} });
    window.confirm = vi.fn(() => true);
    const refresh = vi.fn();
    mockLoadsReturn({ refresh });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Send load to executed' }));

    await waitFor(() => {
      expect(loadsService.setExecuted).toHaveBeenCalledWith(1);
    });
  });

  it('does not show execute button when load is already executed', async () => {
    mockLoadsReturn({
      loads: [{ ...rows[0], ready_to_execute: true, execute: true }],
    });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: 'Send load to executed' })).not.toBeInTheDocument();
    expect(screen.getByTitle('Already executed')).toBeInTheDocument();
  });

  it('individual delete calls loadsService.destroy after confirm', async () => {
    loadsService.destroy.mockResolvedValue({});
    window.confirm = vi.fn(() => true);
    const refresh = vi.fn();
    mockLoadsReturn({ refresh });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Delete load LD-001?');
      expect(loadsService.destroy).toHaveBeenCalledWith(1);
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('individual delete shows alert when API fails', async () => {
    const err = { response: { data: { detail: 'Server error' } } };
    loadsService.destroy.mockRejectedValue(err);
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Server error');
    });
  });

  it('individual delete does nothing when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByTitle('Delete'));

    expect(loadsService.destroy).not.toHaveBeenCalled();
  });

  it('bulk delete calls loadsService.bulkDelete with selected ids', async () => {
    loadsService.bulkDelete.mockResolvedValue({ data: { deleted: 1 } });
    window.confirm = vi.fn(() => true);
    const refresh = vi.fn();
    mockLoadsReturn({ refresh });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select load LD-001' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Delete 1 selected load?');
      expect(loadsService.bulkDelete).toHaveBeenCalledWith([1]);
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('bulk delete is disabled when no load is selected', async () => {
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Delete All/i })).toBeDisabled();
  });

  it('bulk delete shows alert when API fails', async () => {
    const err = { response: { data: { detail: 'Bulk delete failed' } } };
    loadsService.bulkDelete.mockRejectedValue(err);
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select load LD-001' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Bulk delete failed');
    });
  });

  it('bulk delete does nothing when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select load LD-001' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }));

    expect(loadsService.bulkDelete).not.toHaveBeenCalled();
  });

  // ── Update location button ─────────────────────────────────────────────────

  it('renders the "Update location" button in the toolbar', async () => {
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Update location/i })).toBeInTheDocument();
  });

  it('does not call fetchAndSync when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false);
    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Update location/i }));
    expect(rtlService.fetchAndSync).not.toHaveBeenCalled();
  });

  it('calls fetchAndSync, refreshes, and alerts success on confirm', async () => {
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    rtlService.fetchAndSync.mockResolvedValue({});
    const refresh = vi.fn();
    mockLoadsReturn({ refresh });

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Update location/i }));

    await waitFor(() => expect(rtlService.fetchAndSync).toHaveBeenCalledOnce());
    expect(refresh).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/updated successfully/i));
  });

  it('shows error alert when fetchAndSync rejects', async () => {
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    rtlService.fetchAndSync.mockRejectedValue(new Error('RTL error'));
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Update location/i }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/could not be updated/i))
    );
  });

  it('disables the button while the update is in flight', async () => {
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    let resolve;
    rtlService.fetchAndSync.mockReturnValue(new Promise((r) => { resolve = r; }));
    mockLoadsReturn();

    render(<MemoryRouter><LoadsPage /></MemoryRouter>);
    await waitFor(() => expect(usersService.options).toHaveBeenCalled());

    const btn = screen.getByRole('button', { name: /Update location/i });
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByRole('button', { name: /Updating/i })).toBeDisabled());

    resolve({});
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Update location/i })).not.toBeDisabled()
    );
  });
});
