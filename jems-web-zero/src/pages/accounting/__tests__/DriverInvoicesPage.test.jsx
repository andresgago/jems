import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DriverInvoicesPage from '../DriverInvoicesPage'

vi.mock('../../../services/accounting', async () => {
  const actual = await vi.importActual('../../../services/accounting')
  return {
    ...actual,
    driverInvoicesService: {
      list: vi.fn(),
      close: vi.fn(),
      open: vi.fn(),
    },
  }
})

import { driverInvoicesService } from '../../../services/accounting'

const INVOICES = [
  {
    id: 1,
    number: 101,
    driver_name: 'John Doe',
    date: '2026-06-01',
    percent: 25.0,
    status: 1,
  },
  {
    id: 2,
    number: 102,
    driver_name: 'Jane Smith',
    date: '2026-06-05',
    percent: 30.0,
    status: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  driverInvoicesService.list.mockResolvedValue({ data: INVOICES })
})

describe('DriverInvoicesPage', () => {
  it('renders the heading', async () => {
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('Driver Invoices')).toBeInTheDocument()
  })

  it('lists invoices returned by the service', async () => {
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('#101')).toBeInTheDocument()
    expect(screen.getByText('#102')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows Open and Closed status badges', async () => {
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    await screen.findByText('#101')
    // "Open"/"Closed" appear in both the filter dropdown and the badges
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by invoice number', async () => {
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    await screen.findByText('#101')
    fireEvent.change(screen.getByPlaceholderText('Search by # or driver…'), { target: { value: '102' } })
    expect(screen.queryByText('#101')).not.toBeInTheDocument()
    expect(screen.getByText('#102')).toBeInTheDocument()
  })

  it('filters by driver name', async () => {
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.change(screen.getByPlaceholderText('Search by # or driver…'), { target: { value: 'jane' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('closes an open invoice on confirmed click', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driverInvoicesService.close.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    await screen.findByText('#101')
    fireEvent.click(screen.getAllByTitle('Close')[0])
    await waitFor(() => expect(driverInvoicesService.close).toHaveBeenCalledWith(1))
  })

  it('does not close when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    await screen.findByText('#101')
    fireEvent.click(screen.getAllByTitle('Close')[0])
    expect(driverInvoicesService.close).not.toHaveBeenCalled()
  })

  it('shows invoice count in footer', async () => {
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('2 invoices')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    driverInvoicesService.list.mockResolvedValue({ data: [] })
    render(<MemoryRouter><DriverInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('No driver invoices found.')).toBeInTheDocument()
  })
})
