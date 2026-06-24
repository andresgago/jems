import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DispatchHourInvoicesPage from '../DispatchHourInvoicesPage'

vi.mock('../../../services/dispatch', async () => {
  const actual = await vi.importActual('../../../services/dispatch')
  return {
    ...actual,
    hourInvoicesService: {
      list: vi.fn(),
      close: vi.fn(),
      open: vi.fn(),
    },
  }
})

import { hourInvoicesService } from '../../../services/dispatch'

const INVOICES = [
  {
    id: 1,
    number: 301,
    dispatcher: 10,
    dispatcher_name: 'Brunellys T',
    date: '2024-01-31',
    pay_per_hour: '10.00',
    status: 1,
  },
  {
    id: 2,
    number: 302,
    dispatcher: 11,
    dispatcher_name: 'Pedro Cancino',
    date: '2024-02-28',
    pay_per_hour: '17.00',
    status: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  hourInvoicesService.list.mockResolvedValue({ data: INVOICES })
})

describe('DispatchHourInvoicesPage', () => {
  it('renders the heading', async () => {
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText(/Dispatcher Invoices.*By Hour/)).toBeInTheDocument()
  })

  it('lists invoices', async () => {
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('#301')).toBeInTheDocument()
    expect(screen.getByText('#302')).toBeInTheDocument()
    expect(screen.getByText('Brunellys T')).toBeInTheDocument()
    expect(screen.getByText('Pedro Cancino')).toBeInTheDocument()
  })

  it('shows rate in $/h format', async () => {
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    await screen.findByText('#301')
    expect(screen.getByText('$10.00/h')).toBeInTheDocument()
  })

  it('filters by invoice number', async () => {
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    await screen.findByText('#301')
    fireEvent.change(screen.getByPlaceholderText('Search by # or dispatcher…'), {
      target: { value: '302' },
    })
    expect(screen.queryByText('#301')).not.toBeInTheDocument()
    expect(screen.getByText('#302')).toBeInTheDocument()
  })

  it('closes an open invoice on confirmed click', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    hourInvoicesService.close.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    await screen.findByText('#301')
    fireEvent.click(screen.getAllByTitle('Close')[0])
    await waitFor(() => expect(hourInvoicesService.close).toHaveBeenCalledWith(1))
  })

  it('does not close when confirm cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    await screen.findByText('#301')
    fireEvent.click(screen.getAllByTitle('Close')[0])
    expect(hourInvoicesService.close).not.toHaveBeenCalled()
  })

  it('shows empty state', async () => {
    hourInvoicesService.list.mockResolvedValue({ data: [] })
    render(<MemoryRouter><DispatchHourInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('No invoices found.')).toBeInTheDocument()
  })
})
