import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrokerSummaryReportPage from '../BrokerSummaryReportPage';
import BrokerSummaryReportPrintPage from '../BrokerSummaryReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    brokerSummary: vi.fn(),
  },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  year: 2024,
  prior_year: 2023,
  option: 0,
  brokers: [
    {
      id: 1,
      name: 'ACME Broker',
      mc: 'MC1',
      revenue: 12000,
      prior_revenue: 8000,
      deliveries: 3,
      prior_deliveries: 2,
      monthly: [
        { month: 1, revenue: 4000, deliveries: 1 },
        { month: 2, revenue: 8000, deliveries: 2 },
      ],
      prior_monthly: [
        { month: 1, revenue: 3000, deliveries: 1 },
        { month: 2, revenue: 5000, deliveries: 1 },
      ],
      monthly_loads: [
        { month: 1, deliveries: 1 },
        { month: 2, deliveries: 2 },
      ],
      prior_monthly_loads: [
        { month: 1, deliveries: 1 },
        { month: 2, deliveries: 1 },
      ],
    },
  ],
  total_revenue: 12000,
  total_prior_revenue: 8000,
  total_deliveries: 3,
  total_prior_deliveries: 2,
};

const TOTAL_DATA = {
  ...REPORT_DATA,
  option: 1,
  brokers: [],
  total: {
    ...REPORT_DATA.brokers[0],
    id: null,
    name: 'ALL BROKERS',
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <BrokerSummaryReportPage />
    </MemoryRouter>,
  );
}

function renderPrintPage(search = '/print/broker-summary?year=2024&option=0') {
  window.history.pushState({}, '', search);
  return render(
    <MemoryRouter>
      <BrokerSummaryReportPrintPage />
    </MemoryRouter>,
  );
}

describe('BrokerSummaryReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and legacy filters', () => {
    renderPage();
    expect(screen.getByText('Broker Summary')).toBeDefined();
    expect(screen.getByLabelText(/filter by year/i)).toBeDefined();
    expect(screen.getByLabelText(/select option/i)).toBeDefined();
    expect(screen.getByText('Annual Revenues and Deliveries By Brokers')).toBeDefined();
    expect(screen.getByText('Annual Revenues and Deliveries Total')).toBeDefined();
  });

  it('renders Show Report button instead of Run Report', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /run report/i })).toBeNull();
  });

  it('opens print page with selected year and option', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    fireEvent.change(screen.getByLabelText(/filter by year/i), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText(/select option/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(openSpy).toHaveBeenCalledOnce();
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toContain('/print/broker-summary');
    expect(url).toContain('year=2024');
    expect(url).toContain('option=1');
    expect(target).toMatch(/BrokerSummary/);
    openSpy.mockRestore();
  });
});

describe('BrokerSummaryReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders broker annual report', async () => {
    reportsService.brokerSummary.mockResolvedValue({ data: REPORT_DATA });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText('Annual by brokers')).toBeDefined();
      expect(screen.getByText(/1 ACME Broker/)).toBeDefined();
      expect(screen.getByText(/Total Revenues 2024/)).toBeDefined();
      expect(screen.getByRole('img', { name: /revenues 2023 - 2024/i })).toBeDefined();
      expect(screen.getByRole('img', { name: /deliveries 2023 - 2024/i })).toBeDefined();
    });
    expect(reportsService.brokerSummary).toHaveBeenCalledWith({ year: 2024, option: 0 });
  });

  it('loads and renders total annual report', async () => {
    reportsService.brokerSummary.mockResolvedValue({ data: TOTAL_DATA });
    renderPrintPage('/print/broker-summary?year=2024&option=1');
    await waitFor(() => {
      expect(screen.getByText('Annual Total')).toBeDefined();
      expect(screen.getAllByText(/ALL BROKERS/).length).toBeGreaterThan(0);
    });
    expect(reportsService.brokerSummary).toHaveBeenCalledWith({ year: 2024, option: 1 });
  });

  it('shows empty broker message', async () => {
    reportsService.brokerSummary.mockResolvedValue({
      data: { ...REPORT_DATA, brokers: [], total_revenue: 0, total_deliveries: 0 },
    });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/No broker revenue for 2024/i)).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.brokerSummary.mockRejectedValue(new Error('err'));
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load report/i)).toBeDefined();
    });
  });
});
