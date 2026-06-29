import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BalanceSheetReportPrintPage from '../BalanceSheetReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: { balanceSheet: vi.fn() },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  carrier_name: 'BEST WHEELS TRANSPORT LLC',
  date_begin: '2024-06-01',
  date_end: '2024-06-30',
  period: 'month',
  columns: [{ key: '2024-06', label: 'Jun', priority: 1 }],
  current_assets: {
    title: 'Current Assets',
    rows: [{ code: '400', name: 'Cash', amounts: { '2024-06': 1000 }, total: 1000 }],
    totals: { '2024-06': 1000 },
    total: 1000,
  },
  fixed_assets: { title: 'Fixed Assets', rows: [], totals: { '2024-06': 0 }, total: 0 },
  current_liabilities: {
    title: 'Current Liabilities',
    rows: [{ code: '500', name: 'Accounts Payable', amounts: { '2024-06': -400 }, total: -400 }],
    totals: { '2024-06': -400 },
    total: -400,
  },
  long_term_liabilities: { title: 'Long-Term Liabilities', rows: [], totals: { '2024-06': 0 }, total: 0 },
  equity: { title: 'Equity', rows: [], totals: { '2024-06': 0 }, total: 0 },
  total_assets: { amounts: { '2024-06': 1000 }, total: 1000 },
  total_liabilities: { amounts: { '2024-06': -400 }, total: -400 },
  total_liabilities_and_equity: { amounts: { '2024-06': -400 }, total: -400 },
  balance: { amounts: { '2024-06': 1400 }, total: 1400 },
};

function setupLocation(search = '?date_begin=2024-06-01&date_end=2024-06-30&period=1&carrier=2') {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('BalanceSheetReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLocation();
  });

  it('shows loading state initially', () => {
    reportsService.balanceSheet.mockReturnValue(new Promise(() => {}));
    render(<BalanceSheetReportPrintPage />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('fetches balance sheet report with query params', async () => {
    reportsService.balanceSheet.mockResolvedValue({ data: REPORT_DATA });
    render(<BalanceSheetReportPrintPage />);
    await waitFor(() => {
      expect(reportsService.balanceSheet).toHaveBeenCalledWith({
        date_begin: '2024-06-01',
        date_end: '2024-06-30',
        period: '1',
        carrier: '2',
      });
    });
  });

  it('renders report sections and totals', async () => {
    reportsService.balanceSheet.mockResolvedValue({ data: REPORT_DATA });
    render(<BalanceSheetReportPrintPage />);
    await waitFor(() => {
      expect(screen.getByText('Balance Sheet')).toBeDefined();
      expect(screen.getByText('BEST WHEELS TRANSPORT LLC')).toBeDefined();
      expect(screen.getByText('Current Assets')).toBeDefined();
      expect(screen.getByText('Current Liabilities')).toBeDefined();
      expect(screen.getByText('Total assets')).toBeDefined();
      expect(screen.getByText('Total liabilities and equity')).toBeDefined();
      expect(screen.getByText('Balance')).toBeDefined();
    });
  });

  it('shows error when request fails', async () => {
    reportsService.balanceSheet.mockRejectedValue(new Error('fail'));
    render(<BalanceSheetReportPrintPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load report/i)).toBeDefined();
    });
  });
});
