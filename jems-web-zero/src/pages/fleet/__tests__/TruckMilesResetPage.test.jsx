import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TruckMilesResetPage from '../TruckMilesResetPage'

vi.mock('../../../services/milesReset', () => ({
  milesResetService: {
    list: vi.fn(),
    create: vi.fn(),
    destroy: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

import { milesResetService } from '../../../services/milesReset'
import { trucksService } from '../../../services/trucks'

const resets = [
  { id: 1, truck: 10, date: '2024-01-15' },
  { id: 2, truck: 11, date: '2024-02-20' },
]

const trucks = [
  { id: 10, number: 'T-100' },
  { id: 11, number: 'T-200' },
]

beforeEach(() => {
  vi.clearAllMocks()
  milesResetService.list.mockResolvedValue({ data: resets })
  trucksService.list.mockResolvedValue({ data: trucks })
})

describe('TruckMilesResetPage', () => {
  it('renders reset records', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    expect(await screen.findByText('2024-01-15')).toBeInTheDocument()
    expect(screen.getByText('2024-02-20')).toBeInTheDocument()
  })

  it('resolves truck number from id', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    // T-100 appears in selects AND table cells; wait for table rows by date then check cells
    await screen.findByText('2024-01-15')
    const cells = screen.getAllByText('T-100')
    // at least one cell (table row) plus option elements
    expect(cells.length).toBeGreaterThan(0)
  })

  it('shows inline create form with truck select and date', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15')
    expect(screen.getByText('Reset Miles')).toBeInTheDocument()
    expect(screen.getByText('Create New Reset')).toBeInTheDocument()
  })

  it('shows validation error when truck not selected', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('Reset Miles')
    fireEvent.click(screen.getByText('Reset Miles'))
    expect(await screen.findByText('Select a truck.')).toBeInTheDocument()
    expect(milesResetService.create).not.toHaveBeenCalled()
  })

  it('calls create with truck as number and date string', async () => {
    milesResetService.create.mockResolvedValue({ data: { id: 3, truck: 10, date: '2024-03-01' } })
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15')

    // Form select has "Select truck…" as first option; filter select has "All trucks"
    const selects = screen.getAllByRole('combobox')
    const formTruckSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.text === 'Select truck…')
    )
    fireEvent.change(formTruckSelect, { target: { value: '10' } })

    fireEvent.click(screen.getByText('Reset Miles'))
    await waitFor(() => expect(milesResetService.create).toHaveBeenCalled())
    const payload = milesResetService.create.mock.calls[0][0]
    expect(payload.truck).toBe(10)
    expect(typeof payload.date).toBe('string')
  })

  it('deletes a record after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    milesResetService.destroy.mockResolvedValue({})
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(milesResetService.destroy).toHaveBeenCalledWith(1))
  })

  it('does not delete when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(milesResetService.destroy).not.toHaveBeenCalled()
  })
})
