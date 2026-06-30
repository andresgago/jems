import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaxReportPrintPage from '../TaxReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    tax: vi.fn(),
  },
}));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-12-31',
  option: 0,
  drivers: {
    rows: [
      { id: 1, name: 'Alice Smith', email: 'alice@test.com', address: '1 Oak Ave', ssn: '***-**-1111', status: 1, tax: -800 },
      { id: 2, name: 'Bob Jones', email: '', address: '', ssn: '', status: 0, tax: -200 },
    ],
    total_tax: -1000,
  },
  owners: {
    rows: [
      { id: 3, name: 'Carol White', email: 'carol@test.com', address: '5 Pine St', ssn: '***-**-2222', status: 1, tax: -1500 },
    ],
    total_tax: -1500,
  },
  dispatchers: {
    rows: [
      { id: 4, name: 'Dave Brown', email: 'dave@test.com', address: '9 Elm Rd', ssn: '***-**-3333', is_active: true, tax: -400 },
    ],
    total_tax: -400,
  },
};

const REPORT_DATA_WITH_REVENUE = {
  ...REPORT_DATA,
  option: 1,
  drivers: {
    rows: [
      { id: 1, name: 'Alice Smith', email: 'alice@test.com', address: '1 Oak Ave', ssn: '***-**-1111', status: 1, tax: -800, revenue: 800 },
    ],
    total_tax: -800,
    total_revenue: 800,
  },
  owners: {
    rows: [
      { id: 3, name: 'Carol White', email: 'carol@test.com', address: '5 Pine St', ssn: '***-**-2222', status: 1, tax: -1500, revenue: 1500 },
    ],
    total_tax: -1500,
    total_revenue: 1500,
  },
  dispatchers: {
    rows: [
      { id: 4, name: 'Dave Brown', email: 'dave@test.com', address: '9 Elm Rd', ssn: '***-**-3333', is_active: true, tax: -400, revenue: 400 },
    ],
    total_tax: -400,
    total_revenue: 400,
  },
};

function setSearch(qs) {
  Object.defineProperty(window, 'location', {
    value: { search: qs },
    writable: true,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TaxReportPrintPage />
    </MemoryRouter>,
  );
}

describe('TaxReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearch('?date_begin=2024-01-01&date_end=2024-12-31&option=0');
  });

  it('shows loading state initially', () => {
    reportsService.tax.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('shows error when fetch fails', async () => {
    reportsService.tax.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load tax report/i)).toBeDefined();
    });
  });

  it('shows error when date params missing', async () => {
    setSearch('');
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/missing date range/i)).toBeDefined();
    });
  });

  it('renders Tax Report title after data loads', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tax Report' })).toBeDefined();
    });
  });

  it('renders "Drivers, Owner Operators and Dispatchers" header', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Drivers, Owner Operators and Dispatchers')).toBeDefined();
    });
  });

  it('renders date range in header', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Date Range:/)).toBeDefined();
      expect(screen.getByText(/01\/01\/2024/)).toBeDefined();
    });
  });

  it('renders "Generated on:" line', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Generated on:/)).toBeDefined();
    });
  });

  it('renders three section headers: Drivers, Owner Operators, Dispatchers', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Drivers')[0]).toBeDefined();
      expect(screen.getByText('Owner Operators')).toBeDefined();
      expect(screen.getByText('Dispatchers')).toBeDefined();
    });
  });

  it('renders driver names and sequential No. column', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeDefined();
      expect(screen.getByText('Bob Jones')).toBeDefined();
    });
    // Row numbers 1 and 2 should appear
    const cells = screen.getAllByText('1');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('shows inactive indicator (✕) for inactive drivers', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeDefined();
    });
    // Bob Jones has status=0, should show ✕
    expect(screen.getByText('✕')).toBeDefined();
  });

  it('does not show inactive indicator for active drivers', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeDefined();
    });
    // Alice Smith is active (status=1), so ✕ should appear only once (for Bob)
    expect(screen.getAllByText('✕').length).toBe(1);
  });

  it('renders Drivers Total, Owner Operators Total, Dispatchers Total footers', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Drivers Total')).toBeDefined();
      expect(screen.getByText('Owner Operators Total')).toBeDefined();
      expect(screen.getByText('Dispatchers Total')).toBeDefined();
    });
  });

  it('renders grand Total section', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      // "Total" header and "Total" row both appear
      expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('does NOT show Revenues column header when option=0', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeDefined();
    });
    expect(screen.queryByText('Revenues')).toBeNull();
  });

  it('shows Revenues column header when option=1', async () => {
    setSearch('?date_begin=2024-01-01&date_end=2024-12-31&option=1');
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA_WITH_REVENUE });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Revenues').length).toBeGreaterThan(0);
    });
  });

  it('renders revenue amounts in rows when option=1', async () => {
    setSearch('?date_begin=2024-01-01&date_end=2024-12-31&option=1');
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA_WITH_REVENUE });
    renderPage();
    await waitFor(() => {
      // Alice's revenue of 800 should appear formatted
      expect(screen.getByText('Alice Smith')).toBeDefined();
    });
    // $800.00 for driver revenue
    const formatted = screen.getAllByText(/\$\s*800\.00/);
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('calls tax service with carrier param when provided', async () => {
    setSearch('?date_begin=2024-01-01&date_end=2024-12-31&option=0&carrier=2');
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(reportsService.tax).toHaveBeenCalledWith(
        expect.objectContaining({ carrier: '2' }),
      );
    });
  });

  it('does not include carrier param when not in URL', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      const call = reportsService.tax.mock.calls[0][0];
      expect(call.carrier).toBeUndefined();
    });
  });

  it('renders copyright footer', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Copyright © 2019/)).toBeDefined();
    });
  });

  it('renders SSN column headers', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('SSN').length).toBeGreaterThan(0);
    });
  });

  it('renders dash placeholder for missing email and address', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeDefined();
    });
    // Bob Jones has empty email and address, should show '–'
    const dashes = screen.getAllByText('–');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
