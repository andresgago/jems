import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DriversLastLoadsPage from '../DriversLastLoadsPage';

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers');
  return {
    ...actual,
    driversService: {
      ...actual.driversService,
      lastLoads: vi.fn(),
      bulkDelete: vi.fn(),
    },
  };
});

vi.mock('../../../services/rtl', async () => {
  const actual = await vi.importActual('../../../services/rtl');
  return {
    ...actual,
    rtlService: {
      ...actual.rtlService,
      fetchAndSync: vi.fn(),
    },
  };
});

vi.mock('../../../services/users', async () => {
  const actual = await vi.importActual('../../../services/users');
  return {
    ...actual,
    usersService: {
      ...actual.usersService,
      options: vi.fn(),
    },
  };
});

import { driversService } from '../../../services/drivers';
import { rtlService } from '../../../services/rtl';
import { usersService } from '../../../services/users';

const DISPATCHERS = [
  { id: 5, full_name: 'Maria Lopez', username: 'mlopez' },
  { id: 6, full_name: 'Carlos Ruiz', username: 'cruiz' },
];

const ROWS = [
  {
    id: 1,
    full_name: 'John Smith',
    location: null,
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
    location: { state: 'VA', calculated: '5.0mi NNE from Winchester, VA', timestamp: '2025-02-11T16:52:00Z' },
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
  driversService.bulkDelete.mockResolvedValue({ data: { terminated: [], not_found: [] } });
  usersService.options.mockResolvedValue({ data: DISPATCHERS });
  rtlService.fetchAndSync.mockResolvedValue({});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockReturnValue(undefined);
});

function setup() {
  return render(
    <MemoryRouter>
      <DriversLastLoadsPage />
    </MemoryRouter>
  );
}

describe('DriversLastLoadsPage', () => {
  // ── basic rendering ───────────────────────────────────────────────────────

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

  it('shows pickup and dropoff city info', async () => {
    setup();
    expect(await screen.findByText('Charlotte (NC)')).toBeInTheDocument();
    expect(screen.getByText('Atlanta (GA)')).toBeInTheDocument();
  });

  it('shows trailer type in load cell', async () => {
    setup();
    const dvElements = await screen.findAllByText(/DV/);
    expect(dvElements.length).toBeGreaterThan(0);
  });

  it('shows error message on API failure', async () => {
    driversService.lastLoads.mockRejectedValue(new Error('Network error'));
    setup();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    driversService.lastLoads.mockReturnValue(new Promise(() => {}));
    usersService.options.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  // ── checkbox column ───────────────────────────────────────────────────────

  it('renders select-all checkbox in header', async () => {
    setup();
    await screen.findByText('John Smith');
    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    expect(selectAll).toBeInTheDocument();
  });

  it('renders per-row checkboxes', async () => {
    setup();
    await screen.findByText('John Smith');
    expect(screen.getByRole('checkbox', { name: /select john smith/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /select alice brown/i })).toBeInTheDocument();
  });

  it('checking a row checkbox selects that row', async () => {
    setup();
    await screen.findByText('John Smith');
    const cb = screen.getByRole('checkbox', { name: /select john smith/i });
    expect(cb).not.toBeChecked();
    fireEvent.click(cb);
    expect(cb).toBeChecked();
  });

  it('select-all checks all visible rows', async () => {
    setup();
    await screen.findByText('John Smith');
    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    fireEvent.click(selectAll);
    expect(screen.getByRole('checkbox', { name: /select john smith/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /select alice brown/i })).toBeChecked();
  });

  it('clicking select-all again deselects all rows', async () => {
    setup();
    await screen.findByText('John Smith');
    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    fireEvent.click(selectAll);
    fireEvent.click(selectAll);
    expect(screen.getByRole('checkbox', { name: /select john smith/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /select alice brown/i })).not.toBeChecked();
  });

  it('"With selected" bulk bar is always visible', async () => {
    setup();
    await screen.findByText('John Smith');
    expect(screen.getByText(/with selected/i)).toBeInTheDocument();
  });

  it('Delete All button is disabled when nothing is selected', async () => {
    setup();
    await screen.findByText('John Smith');
    expect(screen.getByRole('button', { name: /delete all/i })).toBeDisabled();
  });

  it('Delete All button becomes enabled when rows are selected', async () => {
    setup();
    await screen.findByText('John Smith');
    const btn = screen.getByRole('button', { name: /delete all/i });
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /select john smith/i }));
    expect(btn).not.toBeDisabled();
  });

  it('Delete All button calls bulkDelete with selected IDs', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('checkbox', { name: /select john smith/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete all/i }));
    await waitFor(() => {
      expect(driversService.bulkDelete).toHaveBeenCalledWith([1]);
    });
  });

  it('Delete All button shows confirm dialog before deleting', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('checkbox', { name: /select john smith/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete all/i }));
    });
    expect(window.confirm).toHaveBeenCalled();
  });

  it('Delete All does not call bulkDelete when confirm is cancelled', async () => {
    window.confirm.mockReturnValue(false);
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('checkbox', { name: /select john smith/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete all/i }));
    expect(driversService.bulkDelete).not.toHaveBeenCalled();
  });

  it('Delete All reloads data after successful deletion', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('checkbox', { name: /select john smith/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete all/i }));
    await waitFor(() => {
      // lastLoads is called on mount (1st) and after bulkDelete (2nd)
      expect(driversService.lastLoads.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── # column ─────────────────────────────────────────────────────────────

  it('renders # column header', async () => {
    setup();
    expect(await screen.findByRole('columnheader', { name: '#' })).toBeInTheDocument();
  });

  it('shows sequential row numbers starting at 1', async () => {
    setup();
    await screen.findByText('John Smith');
    // Both rows should have serial numbers
    const cells = screen.getAllByRole('cell');
    const texts = cells.map((c) => c.textContent);
    expect(texts).toContain('1');
    expect(texts).toContain('2');
  });

  // ── driver cell ───────────────────────────────────────────────────────────

  it('driver name is a link to detail page', async () => {
    setup();
    const link = await screen.findByRole('link', { name: 'John Smith' });
    expect(link).toHaveAttribute('href', '/fleet/drivers/1');
  });

  it('shows truck and trailer from last_load in driver cell', async () => {
    setup();
    await screen.findByText('John Smith');
    // TRK-001 appears in the driver cell for John Smith (no current load)
    expect(screen.getByText(/TRK-001/)).toBeInTheDocument();
    expect(screen.getByText(/TRL-001/)).toBeInTheDocument();
  });

  it('shows (-) for truck and trailer when last_load has no vehicle', async () => {
    setup();
    await screen.findByText('Alice Brown');
    // Alice Brown's last_load has null truck/trailer — driver cell shows (-)
    const dashes = screen.getAllByText(/\(-\)/);
    expect(dashes.length).toBeGreaterThan(0);
  });

  // ── current location column ───────────────────────────────────────────────

  it('renders Current Location column header', async () => {
    setup();
    expect(await screen.findByText(/current location/i)).toBeInTheDocument();
  });

  it('shows em-dash in location cell when location is null', async () => {
    setup();
    await screen.findByText('John Smith');
    // John Smith has location: null — confirmed by count of "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows calculated location string when RTL data present', async () => {
    setup();
    await screen.findByText('Alice Brown');
    // Alice Brown has location: { calculated: '5.0mi NNE from Winchester, VA', ... }
    expect(screen.getByText(/5\.0mi NNE from Winchester, VA/)).toBeInTheDocument();
  });

  // ── dispatcher filter dropdown ────────────────────────────────────────────

  it('renders dispatcher dropdown', async () => {
    setup();
    const select = await screen.findByRole('combobox', { name: /filter by dispatcher/i });
    expect(select).toBeInTheDocument();
  });

  it('populates dispatcher dropdown with fetched options', async () => {
    setup();
    await screen.findByRole('option', { name: 'Maria Lopez' });
    expect(screen.getByRole('option', { name: 'Carlos Ruiz' })).toBeInTheDocument();
  });

  it('fetches users/options with dispatchers=true on mount', async () => {
    setup();
    await screen.findByText('John Smith');
    expect(usersService.options).toHaveBeenCalledWith({ dispatchers: true });
  });

  it('calls lastLoads without dispatcher_id by default', async () => {
    setup();
    await screen.findByText('John Smith');
    expect(driversService.lastLoads).toHaveBeenCalledWith(undefined);
  });

  it('calls lastLoads with dispatcher_id when dispatcher is selected', async () => {
    setup();
    const select = await screen.findByRole('combobox', { name: /filter by dispatcher/i });
    fireEvent.change(select, { target: { value: '5' } });
    await waitFor(() => {
      expect(driversService.lastLoads).toHaveBeenCalledWith({ dispatcher_id: '5' });
    });
  });

  it('resets to all drivers when dispatcher selection is cleared', async () => {
    setup();
    const select = await screen.findByRole('combobox', { name: /filter by dispatcher/i });
    fireEvent.change(select, { target: { value: '5' } });
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => {
      // Last call should be without dispatcher_id
      const calls = driversService.lastLoads.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBeUndefined();
    });
  });

  // ── driver name filter ────────────────────────────────────────────────────

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

  // ── row count display ─────────────────────────────────────────────────────

  it('shows item count summary with range', async () => {
    setup();
    await screen.findByText('John Smith');
    // 2 items total → "Showing 1–2 of 2 items."
    expect(screen.getByText(/showing 1.+2 of 2 items/i)).toBeInTheDocument();
  });

  it('updates item count when name filter is applied', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.change(screen.getByPlaceholderText(/filter by driver name/i), {
      target: { value: 'Alice' },
    });
    expect(screen.getByText(/showing 1.+1 of 1 item/i)).toBeInTheDocument();
  });

  // ── pagination ────────────────────────────────────────────────────────────

  it('does not render pagination when all rows fit on one page', async () => {
    // ROWS has 2 items, PAGE_SIZE=15 → no pagination
    setup();
    await screen.findByText('John Smith');
    expect(screen.queryByText(/page \d+ of \d+/i)).not.toBeInTheDocument();
  });

  it('renders pagination when rows exceed page size', async () => {
    // Create 16 rows to force a second page
    const manyRows = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      full_name: `Driver ${String(i + 1).padStart(2, '0')}`,
      location: null,
      last_load: {
        id: 100 + i, number: `LD-${i}`, payment: 1000,
        trailer_type: 'DV',
        pickup_date: '2025-01-10T08:00:00Z',
        pickup_city: 'Charlotte', pickup_state: 'NC', pickup_zip: '28201',
        dropoff_date: '2025-01-12T16:00:00Z',
        dropoff_city: 'Atlanta', dropoff_state: 'GA', dropoff_zip: '30301',
        truck: null, trailer: null,
      },
      current_load: null,
    }));
    driversService.lastLoads.mockResolvedValue({ data: manyRows });
    setup();
    await screen.findByText('Driver 01');
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  it('page 1 shows rows 1–15, page 2 shows row 16', async () => {
    const manyRows = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      full_name: `Driver ${String(i + 1).padStart(2, '0')}`,
      location: null,
      last_load: {
        id: 100 + i, number: `LD-${i}`, payment: 1000,
        trailer_type: 'DV',
        pickup_date: '2025-01-10T08:00:00Z',
        pickup_city: 'Charlotte', pickup_state: 'NC', pickup_zip: '28201',
        dropoff_date: '2025-01-12T16:00:00Z',
        dropoff_city: 'Atlanta', dropoff_state: 'GA', dropoff_zip: '30301',
        truck: null, trailer: null,
      },
      current_load: null,
    }));
    driversService.lastLoads.mockResolvedValue({ data: manyRows });
    setup();
    await screen.findByText('Driver 01');
    expect(screen.getByText('Driver 15')).toBeInTheDocument();
    expect(screen.queryByText('Driver 16')).not.toBeInTheDocument();
    // Navigate to page 2
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(await screen.findByText('Driver 16')).toBeInTheDocument();
    expect(screen.queryByText('Driver 01')).not.toBeInTheDocument();
  });

  // ── update location button ────────────────────────────────────────────────

  it('renders Update location button', async () => {
    setup();
    await screen.findByText('John Smith');
    expect(screen.getByRole('button', { name: /update location/i })).toBeInTheDocument();
  });

  it('Update location calls rtlService.fetchAndSync', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('button', { name: /update location/i }));
    await waitFor(() => {
      expect(rtlService.fetchAndSync).toHaveBeenCalled();
    });
  });

  it('Update location reloads rows after sync', async () => {
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('button', { name: /update location/i }));
    await waitFor(() => {
      expect(driversService.lastLoads.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('Update location does nothing when confirm is cancelled', async () => {
    window.confirm.mockReturnValue(false);
    setup();
    await screen.findByText('John Smith');
    fireEvent.click(screen.getByRole('button', { name: /update location/i }));
    expect(rtlService.fetchAndSync).not.toHaveBeenCalled();
  });
});
