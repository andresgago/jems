import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinancialReportPage from '../FinancialReportPage';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import api from '../../../services/api';

const CARRIER_OPTIONS = [{ id: 1, label: 'Best Wheels Transport LLC (MC-12345)' }];
const DRIVER_OPTIONS = [{ id: 1, full_name: 'John Doe', status: 1, carrier_name: 'Best Wheels Transport LLC' }];
const TRUCK_OPTIONS = [{ id: 10, number: 'T-001' }];
const TRAILER_OPTIONS = [{ id: 20, number: 'TRL-001' }];
const DISPATCHER_OPTIONS = [{ id: 5, full_name: 'Jane Smith' }];

function renderPage() {
  return render(
    <MemoryRouter>
      <FinancialReportPage />
    </MemoryRouter>,
  );
}

async function renderPageSettled() {
  const result = renderPage();
  await act(async () => {});
  return result;
}

describe('FinancialReportPage', () => {
  let mockOpen;

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
    mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
  });

  // ── Basic rendering ────────────────────────────────────────────────────────

  it('renders title', async () => {
    await renderPageSettled();
    expect(screen.getByText('Profit and Loss')).toBeDefined();
  });

  it('renders Show Report button', async () => {
    await renderPageSettled();
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
  });

  it('renders Carrier select with placeholder', async () => {
    await renderPageSettled();
    expect(screen.getByRole('option', { name: 'Select a carrier' })).toBeDefined();
  });

  it('renders Period select with Month/Week/Custom options', async () => {
    await renderPageSettled();
    expect(screen.getByRole('option', { name: 'Month' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Week' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Custom' })).toBeDefined();
  });

  it('renders all four filter listbox labels', async () => {
    await renderPageSettled();
    expect(screen.getByText('Select Driver')).toBeDefined();
    expect(screen.getByText('Select Truck')).toBeDefined();
    expect(screen.getByText('Select Trailer')).toBeDefined();
    expect(screen.getByText('Select Dispatcher')).toBeDefined();
  });

  // ── Options fetching ───────────────────────────────────────────────────────

  it('fetches carriers, drivers, trucks, trailers, dispatchers on mount', async () => {
    renderPage();
    await waitFor(() => {
      const calls = api.get.mock.calls.map((c) => c[0]);
      expect(calls).toContain('/carriers/options/');
      expect(calls).toContain('/drivers/options/');
      expect(calls).toContain('/fleet/trucks/options/');
      expect(calls).toContain('/fleet/trailers/options/');
      expect(calls).toContain('/users/options/');
    });
  });

  it('populates carrier select with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/carriers/options/') return Promise.resolve({ data: CARRIER_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Best Wheels Transport LLC (MC-12345)' })).toBeDefined();
    });
  });

  it('populates driver listbox with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/drivers/options/') return Promise.resolve({ data: DRIVER_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'John Doe (Best Wheels Transport LLC) [on]' })).toBeDefined();
    });
  });

  it('populates truck listbox with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/fleet/trucks/options/') return Promise.resolve({ data: TRUCK_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '#T-001' })).toBeDefined();
    });
  });

  it('populates trailer listbox with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/fleet/trailers/options/') return Promise.resolve({ data: TRAILER_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: '#TRL-001' })).toBeDefined();
    });
  });

  it('populates dispatcher listbox with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/users/options/') return Promise.resolve({ data: DISPATCHER_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Jane Smith' })).toBeDefined();
    });
  });

  // ── Show Report opens new window ───────────────────────────────────────────

  it('opens /print/financial in a new tab when Show Report is clicked', async () => {
    await renderPageSettled();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(mockOpen).toHaveBeenCalledOnce();
    const [url, target] = mockOpen.mock.calls[0];
    expect(url).toMatch(/^\/print\/financial\?/);
    expect(target).toBe('_blank');
  });

  it('includes date_begin and date_end in the print URL', async () => {
    await renderPageSettled();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = mockOpen.mock.calls[0];
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
  });

  it('includes period param in the print URL', async () => {
    await renderPageSettled();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = mockOpen.mock.calls[0];
    expect(url).toContain('period=');
  });
});
