import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrokersStatusPage from '../BrokersStatusPage';

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from '../../../services/api';

const RESULTS = [
  {
    id: 1,
    mc: 'MC001',
    name: 'Acme Freight LLC',
    dba_name: 'Acme',
    status: 1,
    buy_status: '1',
    debtor_buy_status: 'Approved For Purchases',
    safer_operating_status: 'AUTHORIZED',
    factor_company: 'tafs',
    checked_at: '2025-01-15',
    last_load: {
      id: 42,
      number: 'LD-00042',
      pickup_city: 'Charlotte, NC',
      dropoff_city: 'Atlanta, GA',
      payment: '1500.00',
      pickup_date: '2025-01-10T08:00:00Z',
    },
  },
  {
    id: 2,
    mc: 'MC002',
    name: 'Denied Carrier Inc',
    dba_name: '',
    status: 1,
    buy_status: '0',
    debtor_buy_status: 'No Buy - Denied For Purchases',
    safer_operating_status: '',
    factor_company: 'tafs',
    checked_at: null,
    last_load: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

function setup() {
  return render(
    <MemoryRouter>
      <BrokersStatusPage />
    </MemoryRouter>
  );
}

describe('BrokersStatusPage', () => {
  it('renders page title "Brokers Status"', () => {
    setup();
    expect(screen.getByText('Brokers Status')).toBeInTheDocument();
  });

  it('renders search input and Search button', () => {
    setup();
    expect(screen.getByPlaceholderText(/search by name or mc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('Search button disabled when input is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
  });

  it('Search button enabled when input has text', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    expect(screen.getByRole('button', { name: /^search$/i })).not.toBeDisabled();
  });

  it('calls API with correct params on search', async () => {
    api.get.mockResolvedValue({ data: RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/brokers/status-search/', {
        params: { q: 'Acme' },
      });
    });
  });

  it('renders result rows', async () => {
    api.get.mockResolvedValue({ data: RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Acme Freight LLC')).toBeInTheDocument();
    expect(screen.getByText('Denied Carrier Inc')).toBeInTheDocument();
  });

  it('shows debtor_buy_status values', async () => {
    api.get.mockResolvedValue({ data: RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Approved For Purchases')).toBeInTheDocument();
    expect(screen.getByText('No Buy - Denied For Purchases')).toBeInTheDocument();
  });

  it('shows last load info', async () => {
    api.get.mockResolvedValue({ data: RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('#LD-00042')).toBeInTheDocument();
  });

  it('shows em-dash when broker has no last load', async () => {
    api.get.mockResolvedValue({ data: [RESULTS[1]] });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Denied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Denied Carrier Inc');
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows "No brokers found" for empty results', async () => {
    api.get.mockResolvedValue({ data: [] });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'xyz' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText(/no brokers found/i)).toBeInTheDocument();
  });

  it('shows error alert on API failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText(/search failed/i)).toBeInTheDocument();
  });

  it('applies table-danger class to denied broker row', async () => {
    api.get.mockResolvedValue({ data: [RESULTS[1]] });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Denied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Denied Carrier Inc');
    const row = screen.getByText('Denied Carrier Inc').closest('tr');
    expect(row).toHaveClass('table-danger');
  });

  it('applies table-success class to approved broker row', async () => {
    api.get.mockResolvedValue({ data: [RESULTS[0]] });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Acme Freight LLC');
    const row = screen.getByText('Acme Freight LLC').closest('tr');
    expect(row).toHaveClass('table-success');
  });
});
