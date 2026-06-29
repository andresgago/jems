import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShipperReceiverReportPage from '../ShipperReceiverReportPage';

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
    { shipper: 'Shipper A', receiver: 'Receiver B', total: 12 },
    { shipper: 'Shipper C', receiver: 'Receiver D', total: 8 },
  ],
  total_deliveries: 20,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ShipperReceiverReportPage />
    </MemoryRouter>,
  );
}

describe('ShipperReceiverReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('Deliveries from Shipper to Receiver')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders pair rows after run', async () => {
    reportsService.shipperReceiver.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Shipper A')).toBeDefined();
      expect(screen.getByText('Receiver B')).toBeDefined();
      expect(screen.getByText('Total deliveries:')).toBeDefined();
    });
  });

  it('shows empty message when no pairs', async () => {
    const currentYear = new Date().getFullYear();
    reportsService.shipperReceiver.mockResolvedValue({ data: { ...REPORT_DATA, pairs: [], total_deliveries: 0 } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`No executed loads.*${currentYear}`))).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.shipperReceiver.mockRejectedValue(new Error('err'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
