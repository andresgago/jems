import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryTrackingReportPage from '../CategoryTrackingReportPage';

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import api from '../../../services/api';

const TRUCKS = [{ id: 1, number: 'T001' }, { id: 2, number: 'T002' }];
const TRAILERS = [{ id: 3, number: 'TR01' }];
const POSITIONS = [{ id: 1, name: 'Steer Axle' }, { id: 2, name: 'Rear Axle' }];

async function renderPage() {
  render(
    <MemoryRouter>
      <CategoryTrackingReportPage />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(api.get).toHaveBeenCalledWith('/fleet/trucks/options/');
  });
}

describe('CategoryTrackingReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes('/fleet/trucks/options/')) return Promise.resolve({ data: TRUCKS });
      if (url.includes('/fleet/trailers/options/')) return Promise.resolve({ data: TRAILERS });
      if (url.includes('/users/positions/options/')) return Promise.resolve({ data: POSITIONS });
      if (url.includes('/accounting/categories/search/')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });
  });

  it('renders title and Show Report button', async () => {
    await renderPage();
    expect(screen.getByText('Category Tracking')).toBeDefined();
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
  });

  it('renders all filter labels', async () => {
    await renderPage();
    expect(screen.getByText('Filter by Dates')).toBeDefined();
    expect(screen.getByText('Select Truck')).toBeDefined();
    expect(screen.getByText('Select Trailer')).toBeDefined();
    expect(screen.getByText('Select Category')).toBeDefined();
    expect(screen.getByText('Select Position')).toBeDefined();
  });

  it('loads truck options on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/fleet/trucks/options/');
    });
  });

  it('loads trailer options on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/fleet/trailers/options/');
    });
  });

  it('loads position options on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/users/positions/options/');
    });
  });

  it('renders truck options after load', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('#T001')).toBeDefined();
    });
  });

  it('renders trailer options after load', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('#TR01')).toBeDefined();
    });
  });

  it('renders position options after load', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Steer Axle')).toBeDefined();
    });
  });

  it('category search input has correct placeholder', async () => {
    await renderPage();
    const input = screen.getByPlaceholderText(/write 3 letter minimum/i);
    expect(input).toBeDefined();
  });

  it('does not search categories with fewer than 3 chars', async () => {
    renderPage();
    const input = screen.getByPlaceholderText(/write 3 letter minimum/i);
    fireEvent.change(input, { target: { value: 'oi' } });
    await waitFor(() => {
      const calls = api.get.mock.calls.filter((c) => c[0].includes('/accounting/categories/search/'));
      expect(calls.length).toBe(0);
    });
  });

  it('searches categories when 3 or more chars typed', async () => {
    const categories = [{ id: 5, label: 'Oil Filter - OF001 (Unit)', name: 'Oil Filter', code: 'OF001' }];
    api.get.mockImplementation((url, opts) => {
      if (url.includes('/fleet/trucks/options/')) return Promise.resolve({ data: TRUCKS });
      if (url.includes('/fleet/trailers/options/')) return Promise.resolve({ data: TRAILERS });
      if (url.includes('/users/positions/options/')) return Promise.resolve({ data: POSITIONS });
      if (url.includes('/accounting/categories/search/') && opts?.params?.q === 'oil') {
        return Promise.resolve({ data: categories });
      }
      return Promise.resolve({ data: [] });
    });
    renderPage();
    const input = screen.getByPlaceholderText(/write 3 letter minimum/i);
    fireEvent.change(input, { target: { value: 'oil' } });
    await waitFor(() => {
      expect(screen.getByText('Oil Filter - OF001 (Unit)')).toBeDefined();
    });
  });

  it('Show Report button opens new window with date params', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toContain('/print/category-tracking');
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
    expect(target).toBe('_blank');
    openSpy.mockRestore();
  });

  it('Show Report URL has no truck/trailer/category/position params when nothing selected', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    expect(url).not.toContain('truck=');
    expect(url).not.toContain('trailer=');
    expect(url).not.toContain('category=');
    expect(url).not.toContain('position=');
    openSpy.mockRestore();
  });
});

// ── Print page ──────────────────────────────────────────────────────────────

import CategoryTrackingReportPrintPage from '../CategoryTrackingReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    categoryTracking: vi.fn(),
  },
}));

import { reportsService } from '../../../services/reports';

const PRINT_DATA_EMPTY = {
  rows: [],
  total_amount: 0,
  total_quantity: 0,
};

const PRINT_DATA = {
  rows: [
    {
      id: 1,
      date: '2024-05-01',
      truck: 'T001 - VIN123',
      trailer: 'TR01 - VIN456',
      category: 'Oil Filter - OF001 (Unit)',
      position: 'Steer Axle',
      account: '80060 Parts',
      quantity: 2,
      amount: 250,
    },
  ],
  total_amount: 250,
  total_quantity: 2,
};

function renderPrintPage(search = '?date_begin=2024-01-01&date_end=2024-12-31') {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
  });
  return render(
    <MemoryRouter>
      <CategoryTrackingReportPrintPage />
    </MemoryRouter>,
  );
}

describe('CategoryTrackingReportPrintPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders report title', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA_EMPTY });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/Category Tracking Report/i)).toBeDefined();
    });
  });

  it('renders correct table headers', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA_EMPTY });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText('No.')).toBeDefined();
      expect(screen.getByText('Date')).toBeDefined();
      expect(screen.getByText('Truck')).toBeDefined();
      expect(screen.getByText('Trailer')).toBeDefined();
      expect(screen.getByText('Category')).toBeDefined();
      expect(screen.getByText('Position')).toBeDefined();
      expect(screen.getByText('Account')).toBeDefined();
      expect(screen.getByText('Quantity')).toBeDefined();
      expect(screen.getByText('Amount')).toBeDefined();
    });
  });

  it('renders row data with correct fields', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText('T001 - VIN123')).toBeDefined();
      expect(screen.getByText('TR01 - VIN456')).toBeDefined();
      expect(screen.getByText('Oil Filter - OF001 (Unit)')).toBeDefined();
      expect(screen.getByText('Steer Axle')).toBeDefined();
      expect(screen.getByText('80060 Parts')).toBeDefined();
    });
  });

  it('renders total row', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeDefined();
      // multiple $ 250.00 exist (row + footer) — verify at least one
      expect(screen.getAllByText('$ 250.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders empty message when no rows', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA_EMPTY });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/no records found/i)).toBeDefined();
    });
  });

  it('renders filter summary with All Trucks when no truck selected', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA_EMPTY });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/All Trucks/)).toBeDefined();
      expect(screen.getByText(/All Trailers/)).toBeDefined();
      expect(screen.getByText(/All Categories/)).toBeDefined();
      expect(screen.getByText(/All Positions/)).toBeDefined();
    });
  });

  it('renders specific truck label when truck filter passed', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA_EMPTY });
    renderPrintPage('?date_begin=2024-01-01&date_end=2024-12-31&truck=1&truck_label=%23T001');
    await waitFor(() => {
      expect(screen.getByText(/#T001/)).toBeDefined();
    });
  });

  it('shows copyright footer', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: PRINT_DATA_EMPTY });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/Copyright © 2019/)).toBeDefined();
    });
  });

  it('shows error on API failure', async () => {
    reportsService.categoryTracking.mockRejectedValue(new Error('err'));
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeDefined();
    });
  });
});
