import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrokerSummaryReportPage from '../BrokerSummaryReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    brokerSummary: vi.fn(),
  },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  year: 2024,
  option: 0,
  brokers: [
    { id: 1, name: 'ACME Broker', revenue: 12000, prior_revenue: 8000 },
    { id: 2, name: 'FastFreight', revenue: 7000, prior_revenue: 5000 },
  ],
  total_revenue: 19000,
  total_prior_revenue: 13000,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <BrokerSummaryReportPage />
    </MemoryRouter>,
  );
}

describe('BrokerSummaryReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('Broker Summary')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders year selector', () => {
    renderPage();
    const currentYear = new Date().getFullYear();
    expect(screen.getByDisplayValue(String(currentYear))).toBeDefined();
  });

  it('renders broker rows after run', async () => {
    reportsService.brokerSummary.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('ACME Broker')).toBeDefined();
      expect(screen.getByText('FastFreight')).toBeDefined();
    });
  });

  it('shows empty message when no brokers', async () => {
    const currentYear = new Date().getFullYear();
    reportsService.brokerSummary.mockResolvedValue({ data: { ...REPORT_DATA, brokers: [] } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`No broker revenue for ${currentYear}`))).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.brokerSummary.mockRejectedValue(new Error('err'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
