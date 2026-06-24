import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DriversPage from '../DriversPage'

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return {
    ...actual,
    driversService: { list: vi.fn(), toggleStatus: vi.fn() },
  }
})

import { driversService } from '../../../services/drivers'

const drivers = [
  { id: 1, full_name: 'John Doe', driver_type_name: 'Company', phone: '111', email: 'j@x.com', status: 1, license_expiration: '2020-01-01', medical_card_expiration: '2030-01-01', on_vacation: false },
  { id: 2, full_name: 'Jane Roe', driver_type_name: 'Owner', phone: '222', email: 'r@x.com', status: 0, license_expiration: '2030-01-01', medical_card_expiration: '2030-01-01', on_vacation: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  driversService.list.mockResolvedValue({ data: drivers })
})

describe('DriversPage', () => {
  it('lists drivers returned by the service', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Roe')).toBeInTheDocument()
    expect(screen.getByText('On Vacation')).toBeInTheDocument()
  })

  it('filters by name search (client-side)', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.change(screen.getByPlaceholderText('Name…'), { target: { value: 'jane' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Roe')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.change(screen.getByDisplayValue('All'), { target: { value: '0' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Roe')).toBeInTheDocument()
  })

  it('toggles status and refreshes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driversService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(driversService.toggleStatus).toHaveBeenCalledWith(1))
  })
})
