import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SendPacketPage from '../SendPacketPage';

vi.mock('../../../services/brokers', () => ({
  brokersService: {
    options: vi.fn(),
    getContacts: vi.fn(),
  },
}));

vi.mock('../../../services/carriers', () => ({
  carriersService: {
    options: vi.fn(),
    availableFiles: vi.fn(),
    sendPacket: vi.fn(),
  },
}));

import { brokersService } from '../../../services/brokers';
import { carriersService } from '../../../services/carriers';

const CARRIERS = [
  { id: 1, label: 'Jobee Express (MC001)' },
  { id: 2, label: 'Best Wheels (MC002)' },
];

const BROKERS = [
  { id: 10, label: 'Acme Brokerage, MC10 (ACME)' },
  { id: 11, label: 'Echo Logistics, MC11 (ECHO)' },
];

const BROKER_CONTACTS = [
  { id: 101, name: 'Alice Broker', email: 'alice@broker.test', team: false },
  { id: 102, name: 'Bob Broker', email: 'bob@broker.test', team: false },
];

const AVAILABLE_FILES = [
  { slot: 'w9_file', label: 'W9' },
  { slot: 'coi_file', label: 'COI' },
];

beforeEach(() => {
  vi.clearAllMocks();
  carriersService.options.mockResolvedValue({ data: CARRIERS });
  brokersService.options.mockResolvedValue({ data: BROKERS });
  brokersService.getContacts.mockResolvedValue({ data: BROKER_CONTACTS });
});

function setup() {
  return render(
    <MemoryRouter>
      <SendPacketPage />
    </MemoryRouter>
  );
}

const carrierSelect = () => screen.getAllByRole('combobox')[0];
const brokerSelect = () => screen.getAllByRole('combobox')[1];

describe('SendPacketPage', () => {
  it('renders page title', async () => {
    setup();
    expect(await screen.findByText('Send Carrier Packet')).toBeInTheDocument();
  });

  it('renders carrier select with options', async () => {
    setup();
    await screen.findByText('Jobee Express (MC001)');
    expect(screen.getByText('Best Wheels (MC002)')).toBeInTheDocument();
  });

  it('renders broker email input', async () => {
    setup();
    expect(
      await screen.findByPlaceholderText('broker@example.com')
    ).toBeInTheDocument();
  });

  it('renders broker select with options', async () => {
    setup();
    await screen.findByText('Acme Brokerage, MC10 (ACME)');
    expect(screen.getByText('Echo Logistics, MC11 (ECHO)')).toBeInTheDocument();
  });

  it('Send button is disabled initially', async () => {
    setup();
    const btn = await screen.findByRole('button', { name: /^send$/i });
    expect(btn).toBeDisabled();
  });

  it('loads available files when carrier is selected', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await waitFor(() => {
      expect(carriersService.availableFiles).toHaveBeenCalledWith('1');
    });
    expect(await screen.findByText('W9')).toBeInTheDocument();
    expect(screen.getByText('COI')).toBeInTheDocument();
  });

  it('shows "No files" message when carrier has no files', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: [] });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    expect(await screen.findByText(/no files uploaded/i)).toBeInTheDocument();
  });

  it('Send button enabled when carrier + email + file slot selected', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    expect(screen.getByRole('button', { name: /^send$/i })).not.toBeDisabled();
  });

  it('loads contacts when broker is selected', async () => {
    setup();
    await screen.findByText('Acme Brokerage, MC10 (ACME)');
    fireEvent.change(brokerSelect(), { target: { value: '10' } });
    await waitFor(() => {
      expect(brokersService.getContacts).toHaveBeenCalledWith('10');
    });
    expect(await screen.findByText(/Alice Broker/)).toBeInTheDocument();
    expect(screen.getByText(/bob@broker.test/)).toBeInTheDocument();
  });

  it('Send button enabled when carrier + contact + file slot selected', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    fireEvent.change(brokerSelect(), { target: { value: '10' } });
    await screen.findByText('W9');
    await screen.findByText(/Alice Broker/);
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByLabelText(/Alice Broker/));
    expect(screen.getByRole('button', { name: /^send$/i })).not.toBeDisabled();
  });

  it('calls sendPacket with correct args on submit', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockResolvedValue({ data: { detail: 'Packet sent successfully.' } });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await waitFor(() => {
      expect(carriersService.sendPacket).toHaveBeenCalledWith('1', {
        broker_email: 'broker@test.com',
        broker_id: null,
        contact_ids: [],
        file_slots: ['w9_file'],
      });
    });
  });

  it('calls sendPacket with broker contact ids on submit', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockResolvedValue({ data: { detail: 'Packet sent successfully.' } });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    fireEvent.change(brokerSelect(), { target: { value: '10' } });
    await screen.findByText('W9');
    await screen.findByText(/Alice Broker/);
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByLabelText(/Alice Broker/));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await waitFor(() => {
      expect(carriersService.sendPacket).toHaveBeenCalledWith('1', {
        broker_email: '',
        broker_id: 10,
        contact_ids: [101],
        file_slots: ['w9_file'],
      });
    });
  });

  it('selects all team contacts when one team contact is selected', async () => {
    brokersService.getContacts.mockResolvedValue({
      data: [
        { id: 201, name: 'Team One', email: 'team-one@broker.test', team: true },
        { id: 202, name: 'Team Two', email: 'team-two@broker.test', team: true },
      ],
    });
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockResolvedValue({ data: { detail: 'Packet sent successfully.' } });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    fireEvent.change(brokerSelect(), { target: { value: '10' } });
    await screen.findByText('W9');
    await screen.findByText(/Team One/);
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByLabelText(/Team One/));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    await waitFor(() => {
      expect(carriersService.sendPacket).toHaveBeenCalledWith('1', {
        broker_email: '',
        broker_id: 10,
        contact_ids: [201, 202],
        file_slots: ['w9_file'],
      });
    });
  });

  it('shows success message after sending', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockResolvedValue({ data: { detail: 'Packet sent successfully.' } });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByText(/packet was sent successfully/i)).toBeInTheDocument();
  });

  it('shows error alert on API failure', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockRejectedValue({
      response: { data: { error: 'No outgoing email configured.' } },
    });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByText(/no outgoing email configured/i)).toBeInTheDocument();
  });

  it('renders structured API validation errors as text', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    carriersService.sendPacket.mockRejectedValue({
      response: {
        data: { error: { broker_email: ['Ensure this field has no more than 50 characters.'] } },
      },
    });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await screen.findByText('W9');
    fireEvent.change(screen.getByPlaceholderText('broker@example.com'), {
      target: { value: 'broker@test.com' },
    });
    fireEvent.click(screen.getByLabelText('W9'));
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(await screen.findByText(/broker_email: ensure this field/i)).toBeInTheDocument();
  });

  it('resets file list when carrier selection changes', async () => {
    carriersService.availableFiles.mockResolvedValue({ data: AVAILABLE_FILES });
    setup();
    await screen.findByText('Jobee Express (MC001)');
    fireEvent.change(carrierSelect(), { target: { value: '1' } });
    await screen.findByText('W9');
    carriersService.availableFiles.mockResolvedValue({ data: [] });
    fireEvent.change(carrierSelect(), { target: { value: '2' } });
    await waitFor(() => {
      expect(screen.queryByText('W9')).not.toBeInTheDocument();
    });
  });
});
