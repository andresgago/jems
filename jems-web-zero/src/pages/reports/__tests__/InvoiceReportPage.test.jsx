import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InvoiceReportPage from '../InvoiceReportPage';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import api from '../../../services/api';

const CARRIER_OPTIONS = [{ id: 1, label: 'Jobee Express LLC (041672)' }];
const DRIVER_OPTIONS = [{ id: 1, full_name: 'John Doe', status: 1, carrier_name: 'Jobee Express LLC' }];
const INVOICE_OPTIONS = [{ id: 10, number: 5001, driver_name: 'John Doe' }];

function renderPage() {
  return render(
    <MemoryRouter>
      <InvoiceReportPage />
    </MemoryRouter>,
  );
}

async function renderPageSettled() {
  const result = renderPage();
  await act(async () => {});
  return result;
}

describe('InvoiceReportPage', () => {
  let mockOpen;

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
    mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
  });

  it('renders the legacy report title and Show Report button', async () => {
    await renderPageSettled();
    expect(screen.getByText('Profit and Loss By Invoices')).toBeDefined();
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
  });

  it('renders Carrier, Filter by Dates, Select Driver, and Select Invoice filters', async () => {
    await renderPageSettled();
    expect(screen.getByText('Carrier')).toBeDefined();
    expect(screen.getByText('Filter by Dates')).toBeDefined();
    expect(screen.getByText('Select Driver')).toBeDefined();
    expect(screen.getByText('Select Invoice')).toBeDefined();
  });

  it('fetches carrier and driver options on mount', async () => {
    renderPage();
    await waitFor(() => {
      const calls = api.get.mock.calls.map((call) => call[0]);
      expect(calls).toContain('/carriers/options/');
      expect(calls).toContain('/drivers/options/');
    });
  });

  it('fetches open invoice options with the selected date range', async () => {
    renderPage();
    await waitFor(() => {
      const invoiceCall = api.get.mock.calls.find((call) => call[0] === '/accounting/driver-invoices/options/');
      expect(invoiceCall).toBeDefined();
      expect(invoiceCall[1].params).toHaveProperty('date_begin');
      expect(invoiceCall[1].params).toHaveProperty('date_end');
    });
  });

  it('populates carrier, driver, and invoice option labels', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/carriers/options/') return Promise.resolve({ data: CARRIER_OPTIONS });
      if (url === '/drivers/options/') return Promise.resolve({ data: DRIVER_OPTIONS });
      if (url === '/accounting/driver-invoices/options/') return Promise.resolve({ data: INVOICE_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Jobee Express LLC (041672)' })).toBeDefined();
      expect(screen.getByRole('option', { name: 'John Doe (Jobee Express LLC)' })).toBeDefined();
      expect(screen.getByRole('option', { name: 'JE-DRI 5001 - John Doe' })).toBeDefined();
    });
  });

  it('opens /print/invoice in a new tab when Show Report is clicked', async () => {
    await renderPageSettled();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(mockOpen).toHaveBeenCalledOnce();
    const [url, target] = mockOpen.mock.calls[0];
    expect(url).toMatch(/^\/print\/invoice\?/);
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
    expect(target).toBe('_blank');
  });

  it('passes selected carrier, driver, and invoice ids to the print URL', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/carriers/options/') return Promise.resolve({ data: CARRIER_OPTIONS });
      if (url === '/drivers/options/') return Promise.resolve({ data: DRIVER_OPTIONS });
      if (url === '/accounting/driver-invoices/options/') return Promise.resolve({ data: INVOICE_OPTIONS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => screen.getByRole('option', { name: 'JE-DRI 5001 - John Doe' }));
    fireEvent.change(screen.getByLabelText('Carrier'), { target: { value: '1' } });
    const driverSelect = screen.getByLabelText('Select Driver');
    driverSelect.options[0].selected = true;
    fireEvent.change(driverSelect);
    await waitFor(() => screen.getByRole('option', { name: 'JE-DRI 5001 - John Doe' }));
    const invoiceSelect = screen.getByLabelText('Select Invoice');
    invoiceSelect.options[0].selected = true;
    fireEvent.change(invoiceSelect);
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = mockOpen.mock.calls[0];
    expect(url).toContain('carrier=1');
    expect(url).toContain('driver=1');
    expect(url).toContain('invoice=10');
  });
});
