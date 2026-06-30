import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceAnalysisPage from '../InvoiceAnalysisPage';

vi.mock('../../../services/accounting', () => ({
  driverInvoicesService: { analysis: vi.fn() },
}));
vi.mock('../../../services/drivers', () => ({
  driversService: { list: vi.fn() },
}));
vi.mock('../../../services/users', () => ({
  usersService: { options: vi.fn() },
}));
vi.mock('../../../services/carriers', () => ({
  carriersService: { options: vi.fn() },
}));
vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import { driverInvoicesService } from '../../../services/accounting';
import { driversService } from '../../../services/drivers';
import { usersService } from '../../../services/users';
import { carriersService } from '../../../services/carriers';

const DRIVER_OPTIONS = [
  { id: 1, full_name: 'John Doe', status: 1 },
  { id: 2, full_name: 'Jane Smith', status: 1 },
];
const DISPATCHER_OPTIONS = [
  { id: 10, label: 'Jorge Silveira', full_name: 'Jorge Silveira' },
];
const CARRIER_OPTIONS = [
  { id: 5, label: 'JOBEE EXPRESS LLC', name: 'JOBEE EXPRESS LLC' },
];
const ANALYSIS_ROWS = [
  {
    id: 100,
    number: 42,
    date: '2026-06-25',
    driver_name: 'John Doe',
    dispatcher_names: 'Jorge Silveira',
    carrier_name: 'JOBEE EXPRESS LLC',
    load_count: 3,
    gross: 7800.0,
    net: 2312.91,
    acc_90010: 7800.0,
    acc_90011: 0.0,
    acc_80030: 1790.22,
    acc_80084: 20.0,
    acc_10040: 780.0,
    acc_10043: 0.0,
    acc_80081: 0.0,
    acc_80011: 500.0,
    acc_80082: 0.0,
    acc_80080: 0.0,
    acc_80012: 0.0,
    acc_10042: 0.0,
    acc_80013: 0.0,
    acc_80051: 0.0,
    acc_90030: 0.0,
    acc_80035: 0.0,
    acc_80050: 0.0,
    acc_90012: 0.0,
    acc_80036: 0.0,
    acc_80056: 0.0,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoiceAnalysisPage />
    </MemoryRouter>,
  );
}

async function renderSettled() {
  const result = renderPage();
  await act(async () => {});
  return result;
}

describe('InvoiceAnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driversService.list.mockResolvedValue({ data: [] });
    usersService.options.mockResolvedValue({ data: [] });
    carriersService.options.mockResolvedValue({ data: [] });
    driverInvoicesService.analysis.mockResolvedValue({ data: [] });
  });

  it('renders title and Search button', async () => {
    await renderSettled();
    expect(screen.getByText('INVOICES ANALYSIS')).toBeDefined();
    expect(screen.getByRole('button', { name: /search/i })).toBeDefined();
  });

  it('renders date range navigation arrows', async () => {
    await renderSettled();
    const buttons = screen.getAllByRole('button');
    const leftArrow = buttons.find((b) => b.title === 'Previous week');
    const rightArrow = buttons.find((b) => b.title === 'Next week');
    expect(leftArrow).toBeDefined();
    expect(rightArrow).toBeDefined();
  });

  it('renders driver, dispatcher, and carrier filter dropdowns on mount', async () => {
    await renderSettled();
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });

  it('fetches driver, dispatcher, and carrier options on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(driversService.list).toHaveBeenCalledWith({ status: 1 });
      expect(usersService.options).toHaveBeenCalledWith({ dispatchers: 1 });
      expect(carriersService.options).toHaveBeenCalled();
    });
  });

  it('populates driver dropdown with fetched options', async () => {
    driversService.list.mockResolvedValue({ data: DRIVER_OPTIONS });
    await renderSettled();
    expect(screen.getByRole('option', { name: 'John Doe' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Jane Smith' })).toBeDefined();
  });

  it('populates dispatcher dropdown with fetched options', async () => {
    usersService.options.mockResolvedValue({ data: DISPATCHER_OPTIONS });
    await renderSettled();
    expect(screen.getByRole('option', { name: 'Jorge Silveira' })).toBeDefined();
  });

  it('populates carrier dropdown with fetched options', async () => {
    carriersService.options.mockResolvedValue({ data: CARRIER_OPTIONS });
    await renderSettled();
    expect(screen.getByRole('option', { name: 'JOBEE EXPRESS LLC' })).toBeDefined();
  });

  it('calls analysis API with date_begin and date_end on Search click', async () => {
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(driverInvoicesService.analysis).toHaveBeenCalledOnce();
      const params = driverInvoicesService.analysis.mock.calls[0][0];
      expect(params).toHaveProperty('date_begin');
      expect(params).toHaveProperty('date_end');
    });
  });

  it('passes driver filter to analysis params when selected', async () => {
    driversService.list.mockResolvedValue({ data: DRIVER_OPTIONS });
    await renderSettled();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      const params = driverInvoicesService.analysis.mock.calls[0][0];
      expect(String(params.driver)).toBe('1');
    });
  });

  it('renders analysis rows after Search', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeDefined();
      expect(screen.getByText('Jorge Silveira')).toBeDefined();
      expect(screen.getByText('JOBEE EXPRESS LLC')).toBeDefined();
    });
  });

  it('shows load count badge for each row', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(screen.getByText('3')).toBeDefined();
    });
  });

  it('renders I-Rate column header', async () => {
    await renderSettled();
    expect(screen.getByText('I-Rate')).toBeDefined();
  });

  it('renders E-Fuel column header', async () => {
    await renderSettled();
    expect(screen.getByText('E-Fuel')).toBeDefined();
  });

  it('renders Net and Payment column headers', async () => {
    await renderSettled();
    expect(screen.getByText('Net')).toBeDefined();
    expect(screen.getByText('Payment')).toBeDefined();
  });

  it('renders totals row when data is present', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(screen.getByText('Totals')).toBeDefined();
    });
  });

  it('shows row count in header after search', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 invoice/)).toBeDefined();
    });
  });

  it('shows empty message when no results returned', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: [] });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      expect(screen.getByText(/No invoices found/i)).toBeDefined();
    });
  });

  it('expense columns display values as negative', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      // acc_80030 (E-Fuel) = 1790.22 stored, shown as -1,790.22 in data row and totals
      const matches = screen.getAllByText('-1,790.22');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('income columns display values as positive', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      // acc_90010 (I-Rate) = 7800, shown as 7,800.00 in data row and totals
      const matches = screen.getAllByText('7,800.00');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('Refresh button calls analysis again when already searched', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => expect(driverInvoicesService.analysis).toHaveBeenCalledOnce());
    const allBtns = screen.getAllByRole('button');
    const refreshButton = allBtns.find((b) => b.title === 'Refresh');
    expect(refreshButton).toBeDefined();
    fireEvent.click(refreshButton);
    await waitFor(() => expect(driverInvoicesService.analysis).toHaveBeenCalledTimes(2));
  });

  it('shows link to invoice detail page', async () => {
    driverInvoicesService.analysis.mockResolvedValue({ data: ANALYSIS_ROWS });
    await renderSettled();
    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    await waitFor(() => {
      const allLinks = screen.getAllByRole('link');
      const invoiceLink = allLinks.find(
        (l) => l.getAttribute('href') && l.getAttribute('href').includes('/accounting/invoices/drivers/100'),
      );
      expect(invoiceLink).toBeDefined();
    });
  });
});
