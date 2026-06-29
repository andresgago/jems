import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import InvoiceReportPrintPage from '../InvoiceReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: { invoice: vi.fn() },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-01-31',
  invoices: [{ id: 10, number: 5001 }],
  revenues: [
    {
      account_code: '90010',
      account_name: 'Freight Income',
      amount: 5000,
      details: { drivers: [{ id: 1, name: 'John Doe', amount: 5000 }] },
    },
  ],
  expenses: [{ account_code: '80050', account_name: 'Driver Pay', amount: -1500, details: {} }],
  total_revenues: 5000,
  total_expenses: -1500,
  net_profit: 3500,
};

function setupLocation(search = '?date_begin=2024-01-01&date_end=2024-01-31&driver=1&invoice=10') {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('InvoiceReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLocation();
  });

  it('shows loading state initially', () => {
    reportsService.invoice.mockReturnValue(new Promise(() => {}));
    render(<InvoiceReportPrintPage />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('fetches invoice report with query params', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    render(<InvoiceReportPrintPage />);
    await waitFor(() => expect(reportsService.invoice).toHaveBeenCalledOnce());
    const [params] = reportsService.invoice.mock.calls[0];
    expect(params.date_begin).toBe('2024-01-01');
    expect(params.date_end).toBe('2024-01-31');
    expect(params.driver).toEqual(['1']);
    expect(params.invoice).toEqual(['10']);
  });

  it('renders legacy report title and summary label', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    render(<InvoiceReportPrintPage />);
    await waitFor(() => {
      expect(screen.getByText('Profit and Loss By Invoices')).toBeDefined();
      expect(screen.getByText('Summary With Selection [Driver, Invoice]')).toBeDefined();
    });
  });

  it('renders invoice number, account rows, totals, and driver detail', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    render(<InvoiceReportPrintPage />);
    await waitFor(() => {
      expect(screen.getByText('JE-DRI 5001')).toBeDefined();
      expect(screen.getByText('Freight Income')).toBeDefined();
      expect(screen.getByText('Driver Pay')).toBeDefined();
      expect(screen.getByText('TOTAL REVENUES')).toBeDefined();
      expect(screen.getByText('TOTAL EXPENSES')).toBeDefined();
      expect(screen.getByText('NET PROFIT')).toBeDefined();
      expect(screen.getByText('Driver: John Doe')).toBeDefined();
      expect(screen.getByText('$ 3,500.00')).toBeDefined();
    });
  });

  it('shows Summary Total when no driver or invoice is selected', async () => {
    setupLocation('?date_begin=2024-01-01&date_end=2024-01-31');
    reportsService.invoice.mockResolvedValue({ data: { ...REPORT_DATA, invoices: [] } });
    render(<InvoiceReportPrintPage />);
    await waitFor(() => {
      expect(screen.getByText('Summary Total')).toBeDefined();
      expect(screen.getByText('All Invoices')).toBeDefined();
    });
  });
});
