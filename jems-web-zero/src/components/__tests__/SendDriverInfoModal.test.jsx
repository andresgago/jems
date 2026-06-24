import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SendDriverInfoModal from '../SendDriverInfoModal';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../../services/api';

const CARRIERS = [
  { id: 1, name: 'Jobee Express LLC' },
  { id: 2, name: 'Best Wheels Transport LLC' },
];

const DRIVERS = [
  { id: 1, full_name: 'John Doe' },
  { id: 2, full_name: 'Jane Smith' },
];

const LAST_VEHICLE = {
  last_truck_id: 10,
  last_trailer_id: 20,
  trucks: [
    { id: 10, number: 'T-100', vin: '1VIN001' },
    { id: 11, number: 'T-101', vin: '1VIN002' },
  ],
  trailers: [
    { id: 20, number: 'TR-200', vin: '2VIN001', trailer_type__name: 'Van' },
    { id: 21, number: 'TR-201', vin: '2VIN002', trailer_type__name: 'Reefer' },
  ],
};

function setup(onClose = vi.fn()) {
  api.get.mockImplementation((url) => {
    if (url === '/carriers/') return Promise.resolve({ data: CARRIERS });
    if (url === '/drivers/') return Promise.resolve({ data: DRIVERS });
    if (url.includes('/last-vehicle/')) return Promise.resolve({ data: LAST_VEHICLE });
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: { detail: 'Driver information sent successfully.' } });

  return render(<SendDriverInfoModal onClose={onClose} />);
}

describe('SendDriverInfoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal title', async () => {
    setup();
    expect(screen.getByText('Send driver information')).toBeInTheDocument();
  });

  it('populates carrier dropdown from API', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Jobee Express LLC' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Best Wheels Transport LLC' })).toBeInTheDocument();
    });
  });

  it('populates driver dropdown from API', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'John Doe' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Jane Smith' })).toBeInTheDocument();
    });
  });

  it('truck and trailer dropdowns are disabled before driver is selected', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'John Doe' }));
    const selects = screen.getAllByRole('combobox');
    const truckSelect = selects[2];
    const trailerSelect = selects[3];
    expect(truckSelect).toBeDisabled();
    expect(trailerSelect).toBeDisabled();
  });

  it('loads trucks and trailers and auto-selects last used when driver is chosen', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'John Doe' }));

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '1' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/drivers/1/last-vehicle/');
      expect(screen.getByRole('option', { name: /T-100/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /TR-200/ })).toBeInTheDocument();
    });

    const truckSelect = screen.getAllByRole('combobox')[2];
    expect(truckSelect.value).toBe('10');
    const trailerSelect = screen.getAllByRole('combobox')[3];
    expect(trailerSelect.value).toBe('20');
  });

  it('In reply to dropdown is disabled and decorative', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'John Doe' }));
    const selects = screen.getAllByRole('combobox');
    const inReplyTo = selects[4];
    expect(inReplyTo).toBeDisabled();
    expect(inReplyTo).toHaveTextContent('...');
  });

  it('sends correct payload on submit', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'Jobee Express LLC' }));

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '1' } });

    await waitFor(() => screen.getByRole('option', { name: /T-100/ }));

    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '10' } });
    fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: '20' } });
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/loads/send-driver-info/', {
        carrier_id: '1',
        driver_id: '1',
        truck_id: '10',
        trailer_id: '20',
        broker_email: 'broker@test.com',
      });
    });
  });

  it('shows success message after sending', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'John Doe' }));

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '1' } });
    await waitFor(() => screen.getByRole('option', { name: /T-100/ }));
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'b@b.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/sent successfully/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });

  it('shows error alert when API returns error', async () => {
    setup();
    api.post.mockRejectedValueOnce({
      response: { data: { detail: 'SMTP connection failed.' } },
    });

    await waitFor(() => screen.getByRole('option', { name: 'John Doe' }));
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'b@b.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('SMTP connection failed.')).toBeInTheDocument();
    });
  });

  it('Close button calls onClose', async () => {
    const onClose = vi.fn();
    setup(onClose);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
