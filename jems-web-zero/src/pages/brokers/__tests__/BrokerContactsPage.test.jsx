import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BrokerContactsPage from '../BrokerContactsPage'

vi.mock('../../../services/brokerContacts', () => ({
  brokerContactsService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  },
}))

vi.mock('../../../services/brokers', async () => {
  const actual = await vi.importActual('../../../services/brokers')
  return {
    ...actual,
    brokersService: {
      options: vi.fn(),
    },
  }
})

import { brokerContactsService } from '../../../services/brokerContacts'
import { brokersService } from '../../../services/brokers'

const contacts = [
  {
    id: 1,
    broker: 10,
    broker_name: 'Echo Global',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    team: true,
    confirmed: true,
    is_scam: false,
  },
  {
    id: 2,
    broker: 11,
    broker_name: 'Sunrise Freight',
    name: 'Bob Smith',
    email: 'bob@example.com',
    phone: '',
    team: false,
    confirmed: false,
    is_scam: true,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  brokerContactsService.list.mockResolvedValue({ data: { count: 2, results: contacts } })
  brokerContactsService.get.mockResolvedValue({ data: contacts[0] })
  brokerContactsService.create.mockResolvedValue({ data: { id: 3 } })
  brokerContactsService.update.mockResolvedValue({ data: contacts[0] })
  brokerContactsService.destroy.mockResolvedValue({ data: null })
  brokersService.options.mockResolvedValue({
    data: [
      { id: 10, label: 'Echo Global, MC001 (Echo)' },
      { id: 11, label: 'Sunrise Freight, MC002 (Sunrise)' },
    ],
  })
})

describe('BrokerContactsPage', () => {
  it('renders the legacy grid rows and count', async () => {
    render(<BrokerContactsPage />)
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Showing 1-2 of 2 items.')).toBeInTheDocument()
  })

  it('sends column filters to the backend', async () => {
    render(<BrokerContactsPage />)
    await screen.findByText('Alice Johnson')
    fireEvent.change(screen.getByPlaceholderText('Find by email'), { target: { value: 'alice' } })
    await waitFor(() => {
      expect(brokerContactsService.list).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'alice' }))
    })
  })

  it('opens view modal with broker data', async () => {
    render(<BrokerContactsPage />)
    await screen.findByText('Alice Johnson')
    fireEvent.click(screen.getAllByTitle('View')[0])
    expect(await screen.findByText('Broker Alice Johnson')).toBeInTheDocument()
    expect(brokerContactsService.get).toHaveBeenCalledWith(1)
    expect(screen.getAllByText('Echo Global').length).toBeGreaterThan(0)
  })

  it('creates a broker contact from the modal', async () => {
    render(<BrokerContactsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /New Broker/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Contact' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Broker'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(brokerContactsService.create).toHaveBeenCalledWith(expect.objectContaining({
        broker: 10,
        name: 'New Contact',
        email: 'new@example.com',
      }))
    })
  })

  it('updates an existing broker contact from the modal', async () => {
    render(<BrokerContactsPage />)
    await screen.findByText('Alice Johnson')
    fireEvent.click(screen.getAllByTitle('Update')[0])
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '777' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(brokerContactsService.update).toHaveBeenCalledWith(1, expect.objectContaining({ phone: '777' }))
    })
  })

  it('deletes a contact after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<BrokerContactsPage />)
    await screen.findByText('Alice Johnson')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(brokerContactsService.destroy).toHaveBeenCalledWith(1))
    vi.restoreAllMocks()
  })
})
