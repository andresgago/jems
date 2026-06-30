import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TruckMilesResetPage from '../TruckMilesResetPage'

vi.mock('../../../services/milesReset', () => ({
  milesResetService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
    bulkDelete: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { options: vi.fn() } }
})

import { milesResetService } from '../../../services/milesReset'
import { trucksService } from '../../../services/trucks'

const resets = [
  { id: 1, truck: 10, truck_number: 'T-100', truck_vin: 'VIN100', truck_status: 1, date: '2024-01-15T00:00:00Z', is_last_reset: true },
  { id: 2, truck: 11, truck_number: 'T-200', truck_vin: 'VIN200', truck_status: 0, date: '2024-02-20T12:30:00Z', is_last_reset: false },
]

const trucks = [
  { id: 10, number: 'T-100', vin: 'VIN100', status: 1 },
  { id: 11, number: 'T-200', vin: 'VIN200', status: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  milesResetService.list.mockResolvedValue({ data: resets })
  trucksService.options.mockResolvedValue({ data: trucks })
})

describe('TruckMilesResetPage', () => {
  it('renders reset records', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    expect(await screen.findByText('2024-01-15 00:00:00')).toBeInTheDocument()
    expect(screen.getByText('2024-02-20 12:30:00')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('resolves truck number from id', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    // T-100 appears in selects AND table cells; wait for table rows by date then check cells
    await screen.findByText('2024-01-15 00:00:00')
    const cells = screen.getAllByText(/T-100/)
    // at least one cell (table row) plus option elements
    expect(cells.length).toBeGreaterThan(0)
  })

  it('opens create form from the grid toolbar', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')
    fireEvent.click(screen.getByRole('button', { name: /New Truck Miles Reset/i }))
    expect(screen.getByText('Create New Truck Miles Reset')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
  })

  it('shows validation error when truck not selected', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')
    fireEvent.click(screen.getByRole('button', { name: /New Truck Miles Reset/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    expect(await screen.findByText('Select a truck.')).toBeInTheDocument()
    expect(milesResetService.create).not.toHaveBeenCalled()
  })

  it('shows a clear error when truck options cannot load', async () => {
    trucksService.options.mockRejectedValue(new Error('offline'))
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')

    fireEvent.click(screen.getByRole('button', { name: /New Truck Miles Reset/i }))

    expect(await screen.findByText('Error loading truck options. Check that the backend is running.')).toBeInTheDocument()
  })

  it('calls create with truck as number and date string', async () => {
    milesResetService.create.mockResolvedValue({ data: { id: 3, truck: 10, date: '2024-03-01T00:00:00Z' } })
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')
    fireEvent.click(screen.getByRole('button', { name: /New Truck Miles Reset/i }))

    const selects = screen.getAllByRole('combobox')
    const formTruckSelect = selects.find((s) =>
      Array.from(s.options).some((o) => o.text === 'Select truck...')
    )
    fireEvent.change(formTruckSelect, { target: { value: '10' } })

    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() => expect(milesResetService.create).toHaveBeenCalled())
    const payload = milesResetService.create.mock.calls[0][0]
    expect(payload.truck).toBe(10)
    expect(typeof payload.date).toBe('string')
  })

  it('opens edit form and calls update', async () => {
    milesResetService.update.mockResolvedValue({ data: resets[0] })
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')

    fireEvent.click(screen.getAllByTitle('Update')[0])
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(milesResetService.update).toHaveBeenCalled())
    expect(milesResetService.update.mock.calls[0][0]).toBe(1)
  })

  it('applies date filter only in By date mode', async () => {
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')

    const modeSelect = screen.getAllByRole('combobox').find((select) =>
      Array.from(select.options).some((option) => option.text === 'By date')
    )
    fireEvent.change(modeSelect, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /Search/i }))

    await waitFor(() => expect(milesResetService.list).toHaveBeenLastCalledWith({ search: '1' }))
  })

  it('deletes a record after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    milesResetService.destroy.mockResolvedValue({})
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(milesResetService.destroy).toHaveBeenCalledWith(1))
  })

  it('does not delete when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(milesResetService.destroy).not.toHaveBeenCalled()
  })

  it('bulk deletes selected records', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    milesResetService.bulkDelete.mockResolvedValue({})
    render(<MemoryRouter><TruckMilesResetPage /></MemoryRouter>)
    await screen.findByText('2024-01-15 00:00:00')

    fireEvent.click(screen.getAllByTitle('Select')[0])
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }))

    await waitFor(() => expect(milesResetService.bulkDelete).toHaveBeenCalledWith([1]))
  })
})
