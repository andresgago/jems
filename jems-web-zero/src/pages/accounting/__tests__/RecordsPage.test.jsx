import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RecordsPage from '../RecordsPage'

vi.mock('../../../services/accounting', async () => {
  const actual = await vi.importActual('../../../services/accounting')
  return {
    ...actual,
    recordsService: {
      list: vi.fn(),
      destroy: vi.fn(),
    },
  }
})

import { recordsService } from '../../../services/accounting'

const RECORDS = [
  {
    id: 1,
    date: '2026-06-01',
    account_code: '90010',
    account_name: 'Rate',
    amount: 2500.0,
    detail: 'Freight payment',
    record_type: 1,
    load: 1234,
    driver: 5,
    truck: 2,
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 2,
    date: '2026-06-02',
    account_code: '80030',
    account_name: 'Fuel',
    amount: -450.0,
    detail: 'Fuel stop',
    record_type: 2,
    load: null,
    driver: null,
    truck: null,
    created_at: '2026-06-02T10:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  recordsService.list.mockResolvedValue({ data: RECORDS })
})

describe('RecordsPage', () => {
  it('renders the page heading', async () => {
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    expect(await screen.findByText('Accounting Records')).toBeInTheDocument()
  })

  it('lists records returned by the service', async () => {
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    expect(await screen.findByText('90010')).toBeInTheDocument()
    expect(screen.getByText('80030')).toBeInTheDocument()
  })

  it('shows income as positive (green) and expense as negative (red)', async () => {
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    await screen.findByText('90010')
    const amounts = screen.getAllByText(/\$2,500/)
    expect(amounts.length).toBeGreaterThan(0)
    const debitAmounts = screen.getAllByText(/\$450/)
    expect(debitAmounts.length).toBeGreaterThan(0)
  })

  it('shows Income and Expense type badges', async () => {
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    await screen.findByText('Income')
    expect(screen.getByText('Expense')).toBeInTheDocument()
  })

  it('shows record count in footer', async () => {
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    expect(await screen.findByText('2 records')).toBeInTheDocument()
  })

  it('calls destroy and refreshes on confirmed delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    recordsService.destroy.mockResolvedValue({})
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    await screen.findByText('90010')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(recordsService.destroy).toHaveBeenCalledWith(1))
    await waitFor(() => expect(recordsService.list).toHaveBeenCalledTimes(2))
  })

  it('does not delete on cancel', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    await screen.findByText('90010')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(recordsService.destroy).not.toHaveBeenCalled()
  })

  it('shows empty state when no records', async () => {
    recordsService.list.mockResolvedValue({ data: [] })
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    expect(await screen.findByText('No records found.')).toBeInTheDocument()
  })

  it('renders New Record link', async () => {
    render(<MemoryRouter><RecordsPage /></MemoryRouter>)
    await screen.findByText('Accounting Records')
    expect(screen.getByText('New Record')).toBeInTheDocument()
  })
})
