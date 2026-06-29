import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaxReportPage from '../TaxReportPage';

vi.mock('../../../services/reports', () => ({
  reportsService: {
    tax: vi.fn(),
  },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { reportsService } from '../../../services/reports';

const REPORT_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-12-31',
  option: 0,
  drivers: {
    rows: [{ id: 1, name: 'John Smith', email: 'john@test.com', address: '123 Main', ssn: '***-**-1234', status: 1, tax: 500 }],
    total_tax: 500,
  },
  owners: { rows: [], total_tax: 0 },
  dispatchers: { rows: [], total_tax: 0 },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <TaxReportPage />
    </MemoryRouter>,
  );
}

describe('TaxReportPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders title and run button', () => {
    renderPage();
    expect(screen.getByText('Tax Report')).toBeDefined();
    expect(screen.getByRole('button', { name: /run report/i })).toBeDefined();
  });

  it('renders option select', () => {
    renderPage();
    expect(screen.getByText('Standard')).toBeDefined();
    expect(screen.getByText('With Revenue')).toBeDefined();
  });

  it('renders driver rows after run', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeDefined();
      expect(screen.getByText('Drivers (Solo & Team)')).toBeDefined();
    });
  });

  it('passes option param to service', async () => {
    reportsService.tax.mockResolvedValue({ data: REPORT_DATA });
    renderPage();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      const call = reportsService.tax.mock.calls[0][0];
      expect(call.option).toBe(1);
    });
  });

  it('shows error on failure', async () => {
    reportsService.tax.mockRejectedValue(new Error('err'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /run report/i }));
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
  });
});
