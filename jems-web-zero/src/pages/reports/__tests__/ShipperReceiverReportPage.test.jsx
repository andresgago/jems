import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShipperReceiverReportPage from '../ShipperReceiverReportPage';
import ShipperReceiverReportPrintPage from '../ShipperReceiverReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    shipperReceiver: vi.fn(),
  },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  year: 2024,
  option: 0,
  pairs: [
    { shipper: 'Shipper A', receiver: 'Receiver B', total: 12, monthly: null },
    { shipper: 'Shipper C', receiver: 'Receiver D', total: 8, monthly: null },
  ],
  total_deliveries: 20,
};

const MONTHLY_REPORT_DATA = {
  year: 2024,
  option: 1,
  pairs: [
    {
      shipper: 'Shipper A',
      receiver: 'Receiver B',
      total: 12,
      monthly: [
        { month: 1, count: 4 },
        { month: 2, count: 8 },
      ],
    },
  ],
  total_deliveries: 12,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ShipperReceiverReportPage />
    </MemoryRouter>,
  );
}

function renderPrintPage(search = '/print/shipper-receiver?year=2024&option=0') {
  window.history.pushState({}, '', search);
  return render(
    <MemoryRouter>
      <ShipperReceiverReportPrintPage />
    </MemoryRouter>,
  );
}

describe('ShipperReceiverReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders legacy filters and Show Report button', () => {
    renderPage();
    expect(screen.getByText('Deliveries from Shipper to Receiver')).toBeDefined();
    expect(screen.getByLabelText(/filter by year/i)).toBeDefined();
    expect(screen.getByLabelText(/select option/i)).toBeDefined();
    expect(screen.getByText('Deliveries from Shipper to Receiver (Annual Top 30)')).toBeDefined();
    expect(screen.getByText('Deliveries from Shipper to Receiver (By Months Top 10)')).toBeDefined();
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
    expect(url).toContain('/print/shipper-receiver');
    expect(url).toContain('year=2024');
    expect(url).toContain('option=1');
    expect(target).toMatch(/ShipperReceiver/);
    openSpy.mockRestore();
  });

  it('clear year button empties the year input', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /clear year/i }));
    expect(screen.getByLabelText(/filter by year/i).value).toBe('');
  });
});

describe('ShipperReceiverReportPrintPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('loads and renders annual top 30 report', async () => {
    reportsService.shipperReceiver.mockResolvedValue({ data: REPORT_DATA });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Deliveries from Shipper to Receiver' })).toBeDefined();
      expect(screen.getByText('Annual Total (Top 30)')).toBeDefined();
      expect(screen.getByText('Shipper A')).toBeDefined();
      expect(screen.getByText('Receiver B')).toBeDefined();
      expect(screen.getByRole('img', { name: /deliveries from shipper to receiver 2024/i })).toBeDefined();
    });
    expect(reportsService.shipperReceiver).toHaveBeenCalledWith({ year: 2024, option: 0 });
  });

  it('loads and renders monthly top 10 report', async () => {
    reportsService.shipperReceiver.mockResolvedValue({ data: MONTHLY_REPORT_DATA });
    renderPrintPage('/print/shipper-receiver?year=2024&option=1');
    await waitFor(() => {
      expect(screen.getByText('By Months (Top 10)')).toBeDefined();
      expect(screen.getAllByText('Shipper A to Receiver B').length).toBeGreaterThan(0);
      expect(screen.getByRole('img', { name: /monthly deliveries from shipper to receiver 2024/i })).toBeDefined();
    });
    expect(reportsService.shipperReceiver).toHaveBeenCalledWith({ year: 2024, option: 1 });
  });

  it('shows empty message when there are no pairs', async () => {
    reportsService.shipperReceiver.mockResolvedValue({
      data: { ...REPORT_DATA, pairs: [], total_deliveries: 0 },
    });
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/No executed loads with shipper and receiver for 2024/i)).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.shipperReceiver.mockRejectedValue(new Error('err'));
    renderPrintPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load report/i)).toBeDefined();
    });
  });
});
