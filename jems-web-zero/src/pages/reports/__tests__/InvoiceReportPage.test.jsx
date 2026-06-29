import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceReportPage from '../InvoiceReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: { invoice: vi.fn() },
}));

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { reportsService } from '../../../services/reports';
import api from '../../../services/api';

const DRIVER_OPTIONS = [{ id: 1, full_name: 'John Doe', status: 1 }];
const INVOICE_OPTIONS = [{ id: 10, number: 5001 }, { id: 11, number: 5002 }];

const REPORT_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-12-31',
  invoices: [{ id: 10, number: 5001 }],
  revenues: [{ account_code: '90010', account_name: 'Freight Income', amount: 5000, details: {} }],
  expenses: [{ account_code: '80050', account_name: 'Driver Pay', amount: -1000, details: {} }],
  total_revenues: 5000,
  total_expenses: -1000,
  net_profit: 4000,
};

const REPORT_WITH_DRIVER_DETAIL = {
  ...REPORT_DATA,
  revenues: [
    {
      account_code: '90010',
      account_name: 'Freight Income',
      amount: 5000,
      details: { drivers: [{ id: 1, name: 'John Doe', amount: 5000 }] },
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoiceReportPage />
    </MemoryRouter>,
  );
}

async function renderPageSettled() {
  const result = renderPage();
  await act(async () => {});
  return result;
}

describe('InvoiceReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
  });

  // ── Basic rendering ──────────────────────────────────────────────────────

  it('renders title and run button', async () => {
    await renderPageSettled();
    expect(screen.getByText('Profit and Loss')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders Select Driver and Select Invoice filter labels', async () => {
    await renderPageSettled();
    expect(screen.getByText('Select Driver')).toBeDefined();
    expect(screen.getByText('Select Invoice')).toBeDefined();
  });

  // ── Options loading ──────────────────────────────────────────────────────

  it('fetches driver options on mount', async () => {
    renderPage();
    await waitFor(() => {
      const calls = api.get.mock.calls.map((c) => c[0]);
      expect(calls).toContain('/drivers/options/');
    });
  });

  it('fetches invoice options on mount', async () => {
    renderPage();
    await waitFor(() => {
      const calls = api.get.mock.calls.map((c) => c[0]);
      expect(calls).toContain('/accounting/driver-invoices/options/');
    });
  });

  it('populates driver filter with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/drivers/options/') return Promise.resolve({ data: DRIVER_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'John Doe' })).toBeDefined();
    });
  });

  it('populates invoice filter with returned options', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/accounting/driver-invoices/options/') return Promise.resolve({ data: INVOICE_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'DI 5001' })).toBeDefined();
      expect(screen.getByRole('option', { name: 'DI 5002' })).toBeDefined();
    });
  });

  // ── Report execution ─────────────────────────────────────────────────────

  it('calls invoice service with date params on run', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => expect(reportsService.invoice).toHaveBeenCalledOnce());
    const [params] = reportsService.invoice.mock.calls[0];
    expect(params).toHaveProperty('date_begin');
    expect(params).toHaveProperty('date_end');
  });

  it('shows error alert on failure', async () => {
    reportsService.invoice.mockRejectedValue(new Error('Network error'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });

  // ── Table structure ───────────────────────────────────────────────────────

  it('renders Management Indicators and Amount column headers', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Management Indicators')).toBeDefined();
      expect(screen.getByText('Amount')).toBeDefined();
    });
  });

  it('renders TOTAL REVENUES and TOTAL EXPENSES rows', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('TOTAL REVENUES')).toBeDefined();
      expect(screen.getByText('TOTAL EXPENSES')).toBeDefined();
    });
  });

  it('renders NET PROFIT row', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('NET PROFIT')).toBeDefined();
    });
  });

  it('renders account names in the table', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Freight Income')).toBeDefined();
      expect(screen.getByText('Driver Pay')).toBeDefined();
    });
  });

  // ── Summary header ────────────────────────────────────────────────────────

  it('shows "Summary Total" when no filter selected', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Summary Total')).toBeDefined();
    });
  });

  it('shows invoice numbers in DI format in header', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/DI 5001/)).toBeDefined();
    });
  });

  it('shows "Invoices:" label in summary header', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invoices:/)).toBeDefined();
    });
  });

  // ── Driver breakdown ──────────────────────────────────────────────────────

  it('renders driver breakdown when details.drivers is non-empty', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_WITH_DRIVER_DETAIL });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Driver: John Doe/)).toBeDefined();
    });
  });

  it('does not render driver breakdown when details is empty', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Freight Income')).toBeDefined();
    });
    expect(screen.queryByText(/Driver:/)).toBeNull();
  });

  // ── NET PROFIT colour ─────────────────────────────────────────────────────

  it('applies table-success when net profit is positive', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      const row = screen.getByText('NET PROFIT').closest('tr');
      expect(row.className).toContain('table-success');
    });
  });

  it('applies table-danger when net profit is negative', async () => {
    reportsService.invoice.mockResolvedValue({ data: { ...REPORT_DATA, net_profit: -500 } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      const row = screen.getByText('NET PROFIT').closest('tr');
      expect(row.className).toContain('table-danger');
    });
  });
});
