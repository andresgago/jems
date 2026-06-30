import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaxReportPage from '../TaxReportPage';

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import api from '../../../services/api';

const CARRIER_OPTIONS = [
  { id: 1, label: 'JOBEE EXPRESS LLC (041672)' },
  { id: 2, label: 'BEST WHEELS TRANSPORT LLC (1447438)' },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <TaxReportPage />
    </MemoryRouter>,
  );
}

describe('TaxReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: CARRIER_OPTIONS });
  });

  it('renders Tax Report title', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Tax Report')).toBeDefined();
    });
  });

  it('renders "Only Tax" and "Tax and Revenues" option labels', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Only Tax')).toBeDefined();
      expect(screen.getByText('Tax and Revenues')).toBeDefined();
    });
  });

  it('renders "Show Report" button instead of "Run Report"', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
    });
    expect(screen.queryByRole('button', { name: /run report/i })).toBeNull();
  });

  it('renders Carrier select label and "Select a carrier" placeholder', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Carrier')).toBeDefined();
      expect(screen.getByText('Select a carrier')).toBeDefined();
    });
  });

  it('loads carrier options from api on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/carriers/options/');
      expect(screen.getByText('JOBEE EXPRESS LLC (041672)')).toBeDefined();
      expect(screen.getByText('BEST WHEELS TRANSPORT LLC (1447438)')).toBeDefined();
    });
  });

  it('opens print window on Show Report click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/carriers/options/'));
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(openSpy).toHaveBeenCalledOnce();
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('/print/tax');
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
    openSpy.mockRestore();
  });

  it('includes option=1 in print url when Tax and Revenues selected', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/carriers/options/'));
    const select = screen.getByRole('combobox', { name: /select option/i });
    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('option=1');
    openSpy.mockRestore();
  });

  it('includes carrier in print url when carrier selected', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('JOBEE EXPRESS LLC (041672)')).toBeDefined();
    });
    const carrierSelect = screen.getByRole('combobox', { name: /carrier/i });
    fireEvent.change(carrierSelect, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('carrier=1');
    openSpy.mockRestore();
  });

  it('omits carrier param in print url when no carrier selected', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/carriers/options/'));
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    expect(url).not.toContain('carrier=');
    openSpy.mockRestore();
  });

  it('handles carrier options fetch failure gracefully', async () => {
    api.get.mockRejectedValue(new Error('network'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Tax Report')).toBeDefined();
    });
    expect(screen.getByText('Select a carrier')).toBeDefined();
  });
});
