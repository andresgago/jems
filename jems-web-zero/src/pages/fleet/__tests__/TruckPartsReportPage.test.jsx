import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TruckPartsReportPage from '../TruckPartsReportPage';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}));
vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import api from '../../../services/api';

const TRUCKS = [{ id: 1, number: 'T001' }, { id: 2, number: 'T002' }];
const CATEGORY_TYPES = [{ id: 1, name: 'Parts' }, { id: 2, name: 'Service' }];

function renderPage() {
  render(
    <MemoryRouter>
      <TruckPartsReportPage />
    </MemoryRouter>,
  );
}

describe('TruckPartsReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes('/fleet/trucks/options/')) return Promise.resolve({ data: TRUCKS });
      if (url.includes('/accounting/category-types/')) return Promise.resolve({ data: CATEGORY_TYPES });
      if (url.includes('/accounting/categories/search/')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });
  });

  it('renders page title', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('Parts and Pieces Used By Trucks')).toBeDefined();
  });

  it('renders Show Report button', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
  });

  it('renders all filter labels', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('Filter by Dates')).toBeDefined();
    expect(screen.getByText('Date Options')).toBeDefined();
    expect(screen.getByText('Select Truck')).toBeDefined();
    expect(screen.getByText('Select Category Type')).toBeDefined();
    expect(screen.getByText('Select Truck Part Group')).toBeDefined();
    expect(screen.getByText('Select Category')).toBeDefined();
    expect(screen.getByText('Report Options')).toBeDefined();
  });

  it('loads truck options on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/fleet/trucks/options/');
    });
  });

  it('loads category type options on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/accounting/category-types/');
    });
  });

  it('renders loaded truck options', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('#T001')).toBeDefined();
      expect(screen.getByText('#T002')).toBeDefined();
    });
  });

  it('renders loaded category type options', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Parts')).toBeDefined();
      expect(screen.getByText('Service')).toBeDefined();
    });
  });

  it('renders static truck part group options', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('Engine Type')).toBeDefined();
    expect(screen.getByText('Cabin Type')).toBeDefined();
    expect(screen.getByText('Transmission Type')).toBeDefined();
  });

  it('renders report options dropdown', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('Summary By Categories')).toBeDefined();
    expect(screen.getByText('Listing By Categories')).toBeDefined();
  });

  it('renders date options dropdown with By Dates and Show All', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByText('By Dates')).toBeDefined();
    expect(screen.getByText('Show All (Ignore Dates)')).toBeDefined();
  });

  it('can select a truck from the listbox', async () => {
    renderPage();
    await waitFor(() => screen.getByText('#T001'));
    const listbox = screen.getByTitle('All Trucks (Summary)');
    const option = listbox.querySelector('option[value="1"]');
    option.selected = true;
    fireEvent.change(listbox);
    // Clear button appears after selection
    await waitFor(() => expect(screen.getAllByText('Clear').length).toBeGreaterThan(0));
  });

  it('can select a part group from the listbox', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const pgListbox = screen.getByTitle('All Groups');
    const option = pgListbox.querySelector('option[value="1"]');
    option.selected = true;
    fireEvent.change(pgListbox);
    await waitFor(() => expect(screen.getAllByText('Clear').length).toBeGreaterThan(0));
  });

  it('opens print window on Show Report click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(openSpy).toHaveBeenCalledOnce();
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('/print/fleet/truck-parts');
    openSpy.mockRestore();
  });

  it('includes date_begin and date_end in print URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
    openSpy.mockRestore();
  });

  it('includes date_option and report in print URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain('date_option=');
    expect(url).toContain('report=');
    openSpy.mockRestore();
  });

  it('category autocomplete search shows results for >= 3 chars', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/fleet/trucks/options/')) return Promise.resolve({ data: TRUCKS });
      if (url.includes('/accounting/category-types/')) return Promise.resolve({ data: CATEGORY_TYPES });
      if (url.includes('/accounting/categories/search/'))
        return Promise.resolve({ data: [{ id: 5, label: 'Oil Filter - OIL01' }] });
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const input = screen.getByPlaceholderText('All Categories (write 3 letter minimum)');
    fireEvent.change(input, { target: { value: 'Oil' } });
    // Debounced — wait for the API call
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/accounting/categories/search/',
        expect.objectContaining({ params: { q: 'Oil' } }),
      ),
    );
  });

  it('category autocomplete does not search for < 3 chars', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const input = screen.getByPlaceholderText('All Categories (write 3 letter minimum)');
    fireEvent.change(input, { target: { value: 'Oi' } });
    // Still the same call count — no search triggered; wrap in act to flush any pending state
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
    expect(api.get.mock.calls.filter((c) => c[0].includes('search')).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TruckPartsReportPrintPage tests
// ---------------------------------------------------------------------------

import TruckPartsReportPrintPage from '../TruckPartsReportPrintPage';

vi.mock('../../../services/reports', () => ({
  reportsService: { truckParts: vi.fn() },
}));

import { reportsService } from '../../../services/reports';

const MOCK_SUMMARY_DATA = {
  date_begin: '2024-01-01',
  date_end: '2024-12-31',
  date_option: 1,
  report: 1,
  sections: [
    {
      truck_id: null,
      truck_label: 'All',
      rows: [
        {
          no: 1,
          category_id: 1,
          code: 'ENG01',
          name: 'Engine Filter',
          quantity: 3,
          spent: 150.0,
          average_price: 50.0,
          details: 'Detroit [Engine]',
        },
      ],
      total_quantity: 3,
      total_spent: 150.0,
      total_average_price: 50.0,
    },
  ],
  grand_total_quantity: 3,
  grand_total_spent: 150.0,
};

const MOCK_LISTING_DATA = {
  ...MOCK_SUMMARY_DATA,
  report: 2,
  sections: [
    {
      truck_id: 1,
      truck_label: 'T001 - VIN123',
      rows: [
        {
          no: 1,
          date: '2024-06-15',
          category_id: 2,
          code: 'BOLT01',
          name: 'Bolt Set',
          quantity: 5,
          amount: 25.0,
          detail: 'Replaced front bolts',
          details: 'Cummins [Engine]',
        },
      ],
      total_quantity: 5,
      total_spent: 25.0,
    },
  ],
};

function renderPrint(search = '') {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
  });
  render(
    <MemoryRouter>
      <TruckPartsReportPrintPage />
    </MemoryRouter>,
  );
}

describe('TruckPartsReportPrintPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    reportsService.truckParts.mockReturnValue(new Promise(() => {}));
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31');
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('renders summary report with category row', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_SUMMARY_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31&report=1');
    await waitFor(() => screen.getByText('Engine Filter'));
    expect(screen.getByText('ENG01')).toBeDefined();
    expect(screen.getByText('Engine Filter')).toBeDefined();
  });

  it('renders summary title', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_SUMMARY_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31&report=1');
    await waitFor(() => screen.getByText(/Summary/));
    expect(screen.getByText(/Parts and Pieces Used By Trucks \(Summary\)/)).toBeDefined();
  });

  it('renders listing report with date column', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_LISTING_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31&report=2');
    await waitFor(() => screen.getByText('Bolt Set'));
    expect(screen.getByText('2024-06-15')).toBeDefined();
    expect(screen.getByText('Replaced front bolts')).toBeDefined();
  });

  it('renders listing title', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_LISTING_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31&report=2');
    await waitFor(() => screen.getByText(/Listing/));
    expect(screen.getByText(/Parts and Pieces Used By Trucks \(Listing\)/)).toBeDefined();
  });

  it('shows empty state message when no sections', async () => {
    reportsService.truckParts.mockResolvedValue({
      data: { ...MOCK_SUMMARY_DATA, sections: [], grand_total_quantity: 0, grand_total_spent: 0 },
    });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31');
    await waitFor(() => screen.getByText(/no parts and pieces/i));
  });

  it('shows error state when API fails', async () => {
    reportsService.truckParts.mockRejectedValue(new Error('Network Error'));
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31');
    await waitFor(() => screen.getByText(/failed to load/i));
  });

  it('renders Date Range in header', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_SUMMARY_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31');
    await waitFor(() => screen.getByText('Engine Filter'));
    expect(screen.getByText(/Date Range/)).toBeDefined();
  });

  it('shows All when no trucks selected in header', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_SUMMARY_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31');
    await waitFor(() => screen.getByText('Engine Filter'));
    const truckLabel = screen.getAllByText('All');
    expect(truckLabel.length).toBeGreaterThan(0);
  });

  it('renders truck label when truck selected', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_LISTING_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31&report=2&truck_label=%23T001');
    await waitFor(() => screen.getByText('Bolt Set'));
    expect(screen.getByText('#T001')).toBeDefined();
  });

  it('renders print button', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_SUMMARY_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31');
    await waitFor(() => screen.getByText('Engine Filter'));
    expect(screen.getByRole('button', { name: /print/i })).toBeDefined();
  });

  it('show all ignores date range in header label', async () => {
    reportsService.truckParts.mockResolvedValue({
      data: { ...MOCK_SUMMARY_DATA, date_option: 3, sections: [] },
    });
    renderPrint('?date_begin=&date_end=&date_option=3');
    await waitFor(() => screen.getByText(/no parts/i));
    expect(screen.getByText(/Date Range/)).toBeDefined();
    expect(screen.getAllByText('All').length).toBeGreaterThan(0);
  });

  it('calls truckParts with correct params from URL', async () => {
    reportsService.truckParts.mockResolvedValue({ data: MOCK_SUMMARY_DATA });
    renderPrint('?date_begin=2024-01-01&date_end=2024-12-31&date_option=1&report=1&truck=5&category_type=2&part_group=1');
    await waitFor(() => expect(reportsService.truckParts).toHaveBeenCalled());
    const [params] = reportsService.truckParts.mock.calls[0];
    expect(params.date_begin).toBe('2024-01-01');
    expect(params.date_end).toBe('2024-12-31');
    expect(params.date_option).toBe(1);
    expect(params.report).toBe(1);
    expect(params.truck).toEqual(['5']);
    expect(params.category_type).toEqual(['2']);
    expect(params.part_group).toEqual(['1']);
  });
});
