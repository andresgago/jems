import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoryTrackingReportPage from '../CategoryTrackingReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    categoryTracking: vi.fn(),
  },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  rows: [
    { id: 1, date: '2024-05-01', description: 'Oil change', account: 'Vehicle Maintenance', entity: 'TRUCK-01', amount: 250, quantity: 1 },
  ],
  total_amount: 250,
  total_quantity: 1,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <CategoryTrackingReportPage />
    </MemoryRouter>,
  );
}

describe('CategoryTrackingReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('Category Tracking')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders rows after run', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('Oil change')).toBeDefined();
      expect(screen.getByText('Vehicle Maintenance')).toBeDefined();
    });
  });

  it('shows empty message when no rows', async () => {
    reportsService.categoryTracking.mockResolvedValue({ data: { rows: [], total_amount: 0, total_quantity: 0 } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/no category tracking records/i)).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.categoryTracking.mockRejectedValue(new Error('err'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
