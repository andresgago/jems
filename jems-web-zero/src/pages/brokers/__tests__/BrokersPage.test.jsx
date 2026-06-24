import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BrokersPage from '../BrokersPage'

vi.mock('../../../services/brokers', async () => {
  const actual = await vi.importActual('../../../services/brokers')
  return { ...actual, brokersService: { list: vi.fn(), toggleStatus: vi.fn() } }
})

import { brokersService } from '../../../services/brokers'

const brokers = [
  { id: 1, name: 'Sunrise Freight', mc: 'MC001', dba_name: 'Sunrise', email: 'a@a.com', phone: '555', carrier_name: 'Jobee Express LLC', status: 1 },
  { id: 2, name: 'Blue Sky Logistics', mc: 'MC002', dba_name: 'BlueSky', email: 'b@b.com', phone: '666', carrier_name: null, status: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  brokersService.list.mockResolvedValue({ data: brokers })
})

describe('BrokersPage', () => {
  it('lists brokers returned by the service', async () => {
    render(<MemoryRouter><BrokersPage /></MemoryRouter>)
    expect(await screen.findByText('Sunrise Freight')).toBeInTheDocument()
    expect(screen.getByText('Blue Sky Logistics')).toBeInTheDocument()
  })

  it('filters by name, MC or DBA (client-side)', async () => {
    render(<MemoryRouter><BrokersPage /></MemoryRouter>)
    await screen.findByText('Sunrise Freight')
    fireEvent.change(screen.getByPlaceholderText('Name, MC or DBA…'), { target: { value: 'bluesky' } })
    expect(screen.queryByText('Sunrise Freight')).not.toBeInTheDocument()
    expect(screen.getByText('Blue Sky Logistics')).toBeInTheDocument()
  })

  it('shows carrier name or dash for no carrier', async () => {
    render(<MemoryRouter><BrokersPage /></MemoryRouter>)
    await screen.findByText('Sunrise Freight')
    expect(screen.getByText('Jobee Express LLC')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows Active badge for active broker', async () => {
    render(<MemoryRouter><BrokersPage /></MemoryRouter>)
    await screen.findByText('Sunrise Freight')
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('toggles status and refreshes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    brokersService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><BrokersPage /></MemoryRouter>)
    await screen.findByText('Sunrise Freight')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(brokersService.toggleStatus).toHaveBeenCalledWith(1))
  })
})
