import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BrokersStatusModal from '../BrokersStatusModal';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../../services/api';

const BROKER_RESULTS = [
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
    factor_account_id: 'acct-1',
    exists: true,
    source: 'local',
    debtor_rating: 'A',
    debtor_credit_limit: '10000',
    checked_at: '2025-01-15',
    last_load: {
      id: 42,
      number: 'LD-00042',
      pickup_city: 'Charlotte, NC',
      dropoff_city: 'Atlanta, GA',
      payment: '1500.00',
      pickup_date: '2025-01-10T08:00:00Z',
      dropoff_date: '2025-01-11T08:00:00Z',
      driver: 'Jane Driver',
      truck: 'T-101',
      trailer: 'TR-201',
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
    factor_account_id: 'acct-2',
    exists: false,
    source: 'tafs',
    debtor_rating: 'C',
    debtor_credit_limit: '0',
    checked_at: null,
    last_load: null,
  },
];

function setup(onClose = vi.fn()) {
  return render(<BrokersStatusModal onClose={onClose} />);
}

describe('BrokersStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal title "Find broker"', () => {
    setup();
    expect(screen.getByText('Find broker')).toBeInTheDocument();
  });

  it('renders search input and Search button', () => {
    setup();
    expect(screen.getByPlaceholderText(/search by name or mc/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  it('Search button is disabled when input is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
  });

  it('Search button is enabled when input has text', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    expect(screen.getByRole('button', { name: /^search$/i })).not.toBeDisabled();
  });

  it('calls API with correct query param on search', async () => {
    api.get.mockResolvedValue({ data: BROKER_RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/brokers/status-search/', { params: { q: 'Acme' } });
    });
  });

  it('renders result rows in table after successful search', async () => {
    api.get.mockResolvedValue({ data: BROKER_RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText('Acme Freight LLC')).toBeInTheDocument();
      expect(screen.getByText('Denied Carrier Inc')).toBeInTheDocument();
    });
  });

  it('shows debtor_buy_status in results', async () => {
    api.get.mockResolvedValue({ data: BROKER_RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText('Approved For Purchases')).toBeInTheDocument();
      expect(screen.getByText('No Buy - Denied For Purchases')).toBeInTheDocument();
    });
  });

  it('shows TAFS rating and credit limit columns', async () => {
    api.get.mockResolvedValue({ data: BROKER_RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText('TAFS debtor rating')).toBeInTheDocument();
      expect(screen.getByText('TAFS debtor credit limit')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('10000')).toBeInTheDocument();
    });
  });

  it('shows last load info in a broker row', async () => {
    api.get.mockResolvedValue({ data: BROKER_RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText('#LD-00042')).toBeInTheDocument();
      expect(screen.getByText(/Jane Driver/)).toBeInTheDocument();
    });
  });

  it('shows Status updated for existing brokers and add button for missing brokers', async () => {
    api.get.mockResolvedValue({ data: BROKER_RESULTS });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText('Status updated!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add new broker/i })).toBeInTheDocument();
    });
  });

  it('creates a broker from a missing TAFS result', async () => {
    api.get.mockResolvedValue({ data: [BROKER_RESULTS[1]] });
    api.post.mockResolvedValue({
      data: {
        id: 22,
        mc: 'MC002',
        name: 'Denied Carrier Inc',
        dba_name: '',
        phone: '',
        status: 0,
      },
    });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Denied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add new broker/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/brokers/status-search/create/', BROKER_RESULTS[1]);
    });
    expect(await screen.findByText('Status updated!')).toBeInTheDocument();
  });

  it('shows "—" when broker has no last load', async () => {
    api.get.mockResolvedValue({ data: [BROKER_RESULTS[1]] });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Denied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText('Denied Carrier Inc')).toBeInTheDocument();
    });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows "No brokers found" message when results are empty', async () => {
    api.get.mockResolvedValue({ data: [] });
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'NonExistent' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText(/no brokers found/i)).toBeInTheDocument();
    });
  });

  it('shows error alert on API failure', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    setup();
    fireEvent.change(screen.getByPlaceholderText(/search by name or mc/i), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    });
  });

  it('Close button calls onClose', () => {
    const onClose = vi.fn();
    setup(onClose);
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('× close button in header calls onClose', () => {
    const onClose = vi.fn();
    setup(onClose);
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(onClose).toHaveBeenCalled();
  });
});
