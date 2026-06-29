import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SendPacketPage from '../SendPacketPage';

vi.mock('../../../services/carriers', () => ({
  carriersService: {
    list: vi.fn(),
    availableFiles: vi.fn(),
    sendPacket: vi.fn(),
  },
}));

import { carriersService } from '../../../services/carriers';

const CARRIERS = [
  { id: 1, name: 'Jobee Express', mc: 'MC001' },
  { id: 2, name: 'Best Wheels', mc: 'MC002' },
];

const AVAILABLE_FILES = [
  { slot: 'w9_file', label: 'W9' },
  { slot: 'coi_file', label: 'COI' },
];

beforeEach(() => {
  vi.clearAllMocks();
  carriersService.list.mockResolvedValue({ data: CARRIERS });
});

function setup() {
  return render(
    <MemoryRouter>
      <SendPacketPage />
    </MemoryRouter>
  );
}

describe('SendPacketPage', () => {
  it('renders page title', async () => {
    setup();
    expect(await screen.findByText('Send Carrier Packet')).toBeInTheDocument();
  });

  it('renders carrier select with options', async () => {
    setup();
    await screen.findByText('Jobee Express');
    expect(screen.getByText('Best Wheels')).toBeInTheDocument();
  });

  it('renders broker email input', async () => {
    setup();
    expect(
      await screen.findByPlaceholderText('broker@example.com')
    ).toBeInTheDocument();
  });

  it('Send button is disabled initially', async () => {
    setup();
    const btn = await screen.findByRole('button', { name: /^send$/i });
    expect(btn).toBeDisabled();
  });

  it('loads available files when carrier is selected', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express');
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });
    await waitFor(() => {
      expect(carriersService.availableFiles).toHaveBeenCalledWith('1');
    });
    expect(await screen.findByText('W9')).toBeInTheDocument();
    expect(screen.getByText('COI')).toBeInTheDocument();
  });

  it('shows "No files" message when carrier has no files', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: [] });
    setup();
    await screen.findByText('Jobee Express');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(await screen.findByText(/no files uploaded/i)).toBeInTheDocument();
  });

  it('Send button enabled when carrier + email + file slot selected', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    expect(screen.getByRole('button', { name: /^send$/i })).not.toBeDisabled();
  });

  it('calls sendPacket with correct args on submit', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockResolvedValue({ data: { detail: 'Packet sent successfully.' } });
    setup();
    await screen.findByText('Jobee Express');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await waitFor(() => {
      expect(carriersService.sendPacket).toHaveBeenCalledWith('1', {
        broker_email: 'broker@test.com',
        file_slots: ['w9_file'],
      });
    });
  });

  it('shows success message after sending', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockResolvedValue({ data: { detail: 'Packet sent successfully.' } });
    setup();
    await screen.findByText('Jobee Express');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByText(/packet sent successfully/i)).toBeInTheDocument();
  });

  it('shows error alert on API failure', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockRejectedValue({
      response: { data: { error: 'No outgoing email configured.' } },
    });
    setup();
    await screen.findByText('Jobee Express');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByText(/no outgoing email configured/i)).toBeInTheDocument();
  });

  it('resets file list when carrier selection changes', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    await screen.findByText('W9');
    carriersService.availableFiles.mockResolvedValue({ data: [] });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    await waitFor(() => {
      expect(screen.queryByText('W9')).not.toBeInTheDocument();
    });
  });
});
