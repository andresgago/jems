import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DriversLastLoadsPage from '../DriversLastLoadsPage';

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers');
  return {
    ...actual,
    driversService: {
      ...actual.driversService,
      lastLoads: vi.fn(),
    },
  };
});

import { driversService } from '../../../services/drivers';

const ROWS = [
  {
    id: 1,
    full_name: 'John Smith',
    last_load: {
      id: 10,
      number: 'LD-00010',
      payment: 1500,
      trailer_type: 'DV',
      pickup_date: '2025-01-10T08:00:00Z',
      pickup_city: 'Charlotte',
      pickup_state: 'NC',
      pickup_zip: '28201',
      dropoff_date: '2025-01-12T16:00:00Z',
      dropoff_city: 'Atlanta',
      dropoff_state: 'GA',
      dropoff_zip: '30301',
      truck: 'TRK-001',
      trailer: 'TRL-001',
    },
    current_load: null,
  },
  {
    id: 2,
    full_name: 'Alice Brown',
    last_load: {
      id: 20,
      number: 'LD-00020',
      payment: 2000,
      trailer_type: 'RF',
      pickup_date: '2025-02-01T08:00:00Z',
      pickup_city: 'Dallas',
      pickup_state: 'TX',
      pickup_zip: '75201',
      dropoff_date: '2025-02-03T16:00:00Z',
      dropoff_city: 'Houston',
      dropoff_state: 'TX',
      dropoff_zip: '77001',
      truck: null,
      trailer: null,
    },
    current_load: {
      id: 30,
      number: 'LD-00030',
      payment: 2500,
      trailer_type: 'RF',
      pickup_date: '2025-02-10T08:00:00Z',
      pickup_city: 'Miami',
      pickup_state: 'FL',
      pickup_zip: '33101',
      dropoff_date: '2025-02-12T16:00:00Z',
      dropoff_city: 'Orlando',
      dropoff_state: 'FL',
      dropoff_zip: '32801',
      truck: 'TRK-002',
      trailer: 'TRL-002',
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  driversService.lastLoads.mockResolvedValue({ data: ROWS });
});

function setup() {
  return render(
    <MemoryRouter>
      <DriversLastLoadsPage />
    </MemoryRouter>
  );
}

describe('DriversLastLoadsPage', () => {
  it('renders page title', async () => {
    setup();
    expect(await screen.findByText(/drivers.*last loads/i)).toBeInTheDocument();
  });

  it('renders driver rows', async () => {
    setup();
    expect(await screen.findByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
  });

  it('shows load number in last load column', async () => {
    setup();
    expect(await screen.findByText('LD-00010')).toBeInTheDocument();
    expect(screen.getByText('LD-00020')).toBeInTheDocument();
  });

  it('shows current load when present', async () => {
    setup();
    expect(await screen.findByText('LD-00030')).toBeInTheDocument();
  });

  it('shows em-dash when current load is absent', async () => {
    setup();
    await screen.findByText('John Smith');
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('filters by driver name', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.change(screen.getByPlaceholderText(/filter by driver name/i), {
      target: { value: 'Alice' },
    });
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
  });

  it('filter is case-insensitive', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.change(screen.getByPlaceholderText(/filter by driver name/i), {
      target: { value: 'john' },
    });
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
  });

  it('shows "No results found" when filter matches nothing', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.change(screen.getByPlaceholderText(/filter by driver name/i), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it('shows pickup and dropoff city info', async () => {
    setup();
    expect(await screen.findByText('Charlotte (NC)')).toBeInTheDocument();
    expect(screen.getByText('Atlanta (GA)')).toBeInTheDocument();
  });

  it('shows truck and trailer in load cell', async () => {
    setup();
    expect(await screen.findByText(/TRK-001/)).toBeInTheDocument();
    expect(screen.getByText(/TRL-001/)).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    driversService.lastLoads.mockRejectedValue(new Error('Network error'));
    setup();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    // Delay resolution so we can catch the loading state
    driversService.lastLoads.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders trailer type in load cell', async () => {
    setup();
    const dvElements = await screen.findAllByText(/DV/);
    expect(dvElements.length).toBeGreaterThan(0);
  });
});
