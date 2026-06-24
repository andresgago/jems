import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DispatchPercentInvoicesPage from '../DispatchPercentInvoicesPage'

vi.mock('../../../services/dispatch', async () => {
  const actual = await vi.importActual('../../../services/dispatch')
  return {
    ...actual,
    percentInvoicesService: {
      list: vi.fn(),
      close: vi.fn(),
      open: vi.fn(),
    },
  }
})

import { percentInvoicesService } from '../../../services/dispatch'

const INVOICES = [
  {
    id: 1,
    number: 201,
    dispatcher: 10,
    dispatcher_name: 'Lilian Hernandez',
    date: '2024-01-31',
    percent: '2.50',
    status: 1,
  },
  {
    id: 2,
    number: 202,
    dispatcher: 11,
    dispatcher_name: 'Pedro Cancino',
    date: '2024-02-28',
    percent: '2.00',
    status: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  percentInvoicesService.list.mockResolvedValue({ data: INVOICES })
})

describe('DispatchPercentInvoicesPage', () => {
  it('renders the heading', async () => {
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText(/Dispatcher Invoices.*By Percent/)).toBeInTheDocument()
  })

  it('lists invoices', async () => {
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('#201')).toBeInTheDocument()
    expect(screen.getByText('#202')).toBeInTheDocument()
    expect(screen.getByText('Lilian Hernandez')).toBeInTheDocument()
    expect(screen.getByText('Pedro Cancino')).toBeInTheDocument()
  })

  it('shows Open and Closed status badges', async () => {
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    await screen.findByText('#201')
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by invoice number', async () => {
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    await screen.findByText('#201')
    fireEvent.change(screen.getByPlaceholderText('Search by # or dispatcher…'), {
      target: { value: '202' },
    })
    expect(screen.queryByText('#201')).not.toBeInTheDocument()
    expect(screen.getByText('#202')).toBeInTheDocument()
  })

  it('filters by dispatcher name', async () => {
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    await screen.findByText('Lilian Hernandez')
    fireEvent.change(screen.getByPlaceholderText('Search by # or dispatcher…'), {
      target: { value: 'pedro' },
    })
    expect(screen.queryByText('Lilian Hernandez')).not.toBeInTheDocument()
    expect(screen.getByText('Pedro Cancino')).toBeInTheDocument()
  })

  it('closes an open invoice on confirmed click', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    percentInvoicesService.close.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    await screen.findByText('#201')
    fireEvent.click(screen.getAllByTitle('Close')[0])
    await waitFor(() => expect(percentInvoicesService.close).toHaveBeenCalledWith(1))
  })

  it('does not close when confirm cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    await screen.findByText('#201')
    fireEvent.click(screen.getAllByTitle('Close')[0])
    expect(percentInvoicesService.close).not.toHaveBeenCalled()
  })

  it('shows invoice count in footer', async () => {
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('2 invoices')).toBeInTheDocument()
  })

  it('shows empty state', async () => {
    percentInvoicesService.list.mockResolvedValue({ data: [] })
    render(<MemoryRouter><DispatchPercentInvoicesPage /></MemoryRouter>)
    expect(await screen.findByText('No invoices found.')).toBeInTheDocument()
  })
})
