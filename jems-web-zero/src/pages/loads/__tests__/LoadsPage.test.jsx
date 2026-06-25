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

import { useLoads } from '../../../hooks/useLoads';
import { useAuth } from '../../../contexts/useAuth';
import { usersService } from '../../../services/users';
import { brokersService } from '../../../services/brokers';
import { driversService } from '../../../services/drivers';

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
    truck_number: '4268',
    trailer_number: 'J534242',
    trailer_type_short_name: 'V',
    load_trailer_type_short_name: 'V',
    rate_file: '/media/rate.pdf',
    bill_file: '/media/bill.pdf',
    assignment_complete: true,
    ready_to_execute: true,
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
});
