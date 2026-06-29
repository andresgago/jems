import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinancialReportPage from '../FinancialReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    financial: vi.fn(),
  },
}));

// flatpickr requires a real DOM; stub it for tests
vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  revenues: [{ code: '90010', name: 'Freight Income', amount: 5000 }],
  expenses: [{ code: '80050', name: 'Driver Pay', amount: -1000 }],
  total_revenues: 5000,
  total_expenses: -1000,
  net_profit: 4000,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <FinancialReportPage />
    </MemoryRouter>,
  );
}

describe('FinancialReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('Profit and Loss')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('calls financial service on run', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => expect(reportsService.financial).toHaveBeenCalledOnce());
  });

  it('renders revenue and expense tables after run', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Revenues')).toBeDefined();
      expect(screen.getByText('Expenses')).toBeDefined();
      expect(screen.getByText('Freight Income')).toBeDefined();
      expect(screen.getByText('Driver Pay')).toBeDefined();
    });
  });

  it('renders net profit after run', async () => {
    reportsService.financial.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Net Profit')).toBeDefined();
    });
  });

  it('shows error alert on failure', async () => {
    reportsService.financial.mockRejectedValue(new Error('Network error'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
