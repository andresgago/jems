import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceReportPage from '../InvoiceReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    invoice: vi.fn(),
  },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-12-31',
  invoices: [{ id: 1, number: 'INV-001' }],
  revenues: [{ account_code: '90010', account_name: 'Freight Income', amount: 5000, details: {} }],
  expenses: [{ account_code: '80050', account_name: 'Driver Pay', amount: -1000, details: {} }],
  total_revenues: 5000,
  total_expenses: -1000,
  net_profit: 4000,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoiceReportPage />
    </MemoryRouter>,
  );
}

describe('InvoiceReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('Profit and Loss By Invoices')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders revenue and expense account rows after run', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Freight Income')).toBeDefined();
      expect(screen.getByText('Driver Pay')).toBeDefined();
      expect(screen.getByText('Net Profit')).toBeDefined();
    });
  });

  it('shows invoice count label', async () => {
    reportsService.invoice.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 invoice included/i)).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.invoice.mockRejectedValue(new Error('err'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
