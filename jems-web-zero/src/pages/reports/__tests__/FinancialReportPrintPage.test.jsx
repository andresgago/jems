import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FinancialReportPrintPage from '../FinancialReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: { financial: vi.fn() },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  carrier_name: 'BEST WHEELS TRANSPORT LLC',
  date_begin: '2024-06-01',
  date_end: '2024-06-30',
  ytd_begin: '2024-01-01',
  revenues: [
    { account_code: '90010', account_name: 'Rate', amount: 1000, ytd_amount: 5000, details: {} },
  ],
  expenses: [
    { account_code: '80050', account_name: 'Payroll', amount: -450, ytd_amount: -2000, details: {} },
  ],
  total_revenues: 1000,
  ytd_total_revenues: 5000,
  total_expenses: -450,
  ytd_total_expenses: -2000,
  net_profit: 550,
  ytd_net_profit: 3000,
};

function setupLocation(search = '?date_begin=2024-06-01&date_end=2024-06-30&period=month') {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

function renderPage() {
  return render(<FinancialReportPrintPage />);
}

describe('FinancialReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLocation();
  });

  it('shows loading state initially', () => {
    reportsService.financial.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('fetches financial report on mount', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => expect(reportsService.financial).toHaveBeenCalledOnce());
  });

  it('shows error when request fails', async () => {
    reportsService.financial.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });

  it('renders carrier company name', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('BEST WHEELS TRANSPORT LLC')).toBeDefined();
    });
  });

  it('renders "Profit and Loss by Month" title for month period', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Profit and Loss by Month/i)).toBeDefined();
    });
  });

  it('renders Incomes section header', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Incomes')).toBeDefined();
    });
  });

  it('renders Expenses section header', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Expenses')).toBeDefined();
    });
  });

  it('renders account names from revenues and expenses', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rate')).toBeDefined();
      expect(screen.getByText('Payroll')).toBeDefined();
    });
  });

  it('renders Total income row', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total income')).toBeDefined();
    });
  });

  it('renders Total expenses row', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total expenses')).toBeDefined();
    });
  });

  it('renders Net income row', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Net income')).toBeDefined();
    });
  });

  it('renders YTD column header', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('YTD')).toBeDefined();
    });
  });

  it('renders period column header (month abbreviation)', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Jun')).toBeDefined();
    });
  });

  it('falls back to JOBEE EXPRESS LLC when carrier_name is empty', async () => {
    reportsService.financial.mockResolvedValue({ data: { ...REPORT_DATA, carrier_name: '' } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('JOBEE EXPRESS LLC')).toBeDefined();
    });
  });
});
