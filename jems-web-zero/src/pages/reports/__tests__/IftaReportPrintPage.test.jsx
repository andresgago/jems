import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IftaReportPrintPage from '../IftaReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: { ifta: vi.fn() },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  date_begin: '2024-06-22',
  date_end: '2024-06-29',
  rows: [
    {
      state_name: 'North Carolina',
      state_abbreviation: 'NC',
      gallons: 300.5,
      cards: [
        { card_number: 'CARD-001', gallons: 200.0 },
        { card_number: 'CARD-002', gallons: 100.5 },
      ],
    },
    {
      state_name: 'Florida',
      state_abbreviation: 'FL',
      gallons: 150.0,
      cards: [{ card_number: 'CARD-001', gallons: 150.0 }],
    },
  ],
  total_gallons: 450.5,
};

function setupLocation(search = '?date_begin=2024-06-22&date_end=2024-06-29') {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

function renderPage() {
  return render(<IftaReportPrintPage />);
}

describe('IftaReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLocation();
  });

  it('shows loading state initially', () => {
    reportsService.ifta.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('fetches IFTA report on mount with correct params', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => expect(reportsService.ifta).toHaveBeenCalledOnce());
    const args = reportsService.ifta.mock.calls[0][0];
    expect(args.date_begin).toBe('2024-06-22');
    expect(args.date_end).toBe('2024-06-29');
  });

  it('shows error when fetch fails', async () => {
    reportsService.ifta.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });

  it('shows error when date params are missing', async () => {
    setupLocation('');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/missing date range/i)).toBeDefined();
    });
  });

  it('renders IFTA title', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'IFTA' })).toBeDefined();
    });
  });

  it('renders State / Fuel Card header', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('State / Fuel Card')).toBeDefined();
    });
  });

  it('renders date range in header', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Date Range:/)).toBeDefined();
      expect(screen.getByText(/2024-06-22/)).toBeDefined();
      expect(screen.getByText(/2024-06-29/)).toBeDefined();
    });
  });

  it('renders No. / State / Gallons column headers', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No.')).toBeDefined();
      expect(screen.getByText('State')).toBeDefined();
      expect(screen.getByText('Gallons')).toBeDefined();
    });
  });

  it('renders state row with sequential number and name+code', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('North Carolina (NC)')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText('Florida (FL)')).toBeDefined();
    });
  });

  it('renders Cards sub-header for each state', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      const cardHeaders = screen.getAllByText('Cards');
      expect(cardHeaders.length).toBe(2);
    });
  });

  it('renders card rows under each state', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('CARD-001').length).toBe(2);
      expect(screen.getByText('CARD-002')).toBeDefined();
    });
  });

  it('renders TOTAL OF GALLONS row', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('TOTAL OF GALLONS')).toBeDefined();
    });
  });

  it('formats gallons to 3 decimal places', async () => {
    reportsService.ifta.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('300.500')).toBeDefined();
    });
  });

  it('renders zero total when no rows', async () => {
    reportsService.ifta.mockResolvedValue({
      data: { date_begin: '2024-06-22', date_end: '2024-06-29', rows: [], total_gallons: 0 },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('TOTAL OF GALLONS')).toBeDefined();
      expect(screen.getByText('0.000')).toBeDefined();
    });
  });
});
