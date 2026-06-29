import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IftaReportPage from '../IftaReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    ifta: vi.fn(),
  },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-12-31',
  rows: [
    {
      state_name: 'North Carolina',
      state_abbreviation: 'NC',
      gallons: 300.5,
      cards: [{ card_number: 'CARD-001', gallons: 300.5 }],
    },
  ],
  total_gallons: 300.5,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <IftaReportPage />
    </MemoryRouter>,
  );
}

describe('IftaReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('IFTA Report')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders state and card rows after run', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/North Carolina/)).toBeDefined();
      expect(screen.getByText('CARD-001')).toBeDefined();
    });
  });

  it('shows grand total after run', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Grand Total/i)).toBeDefined();
    });
  });

  it('shows empty message when no rows', async () => {
    reportsService.ifta.mockResolvedValue({ data: { ...REPORT_DATA, rows: [], total_gallons: 0 } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/no IFTA records/i)).toBeDefined();
    });
  });

  it('shows error on failure', async () => {
    reportsService.ifta.mockRejectedValue(new Error('err'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
