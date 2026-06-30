import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrailerMaintenancesPage from '../TrailerMaintenancesPage'

vi.mock('../../../services/trailerMaintenance', () => ({
  trailerMaintenanceService: {
    list: vi.fn(),
    destroy: vi.fn(),
    bulkDelete: vi.fn(),
  },
}))

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { list: vi.fn() } }
})

import { trailerMaintenanceService } from '../../../services/trailerMaintenance'
import { trailersService } from '../../../services/trailers'

const records = [
  {
    id: 1,
    trailer: 20,
    trailer_number: 'TRL-001',
    trailer_vin: '',
    date: '2024-06-01',
    miles: 80000,
    miles_alert: 1,
    time_alert: 0,
    time_year: 0,
    time_month: 0,
    detail: 'Annual inspection',
    is_last_maintenance: true,
    miles_alert_message: 'Active alert for 80000 miles (Miles traveled 0 miles)',
    time_alert_message: 'Not Alert',
  },
  {
    id: 2,
    trailer: 21,
    trailer_number: 'TRL-002',
    trailer_vin: '',
    date: '2024-07-15',
    miles: 0,
    miles_alert: 0,
    time_alert: 1,
    time_year: 0,
    time_month: 6,
    detail: '',
    is_last_maintenance: false,
    miles_alert_message: 'Not Alert',
    time_alert_message: 'Inactive alert for 6 months',
  },
]

const trailers = [
  { id: 20, number: 'TRL-001' },
  { id: 21, number: 'TRL-002' },
]

beforeEach(() => {
  vi.clearAllMocks()
  trailerMaintenanceService.list.mockResolvedValue({ data: records })
  trailersService.list.mockResolvedValue({ data: trailers })
})

describe('TrailerMaintenancesPage', () => {
  it('renders trailer maintenance records', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText('2024-06-01')).toBeInTheDocument()
    expect(screen.getByText('2024-07-15')).toBeInTheDocument()
  })

  it('shows trailer number linked to trailer detail', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: 'TRL-001' })
    expect(link.getAttribute('href')).toBe('/fleet/trailers/20')
  })

  it('shows time alert badge when enabled', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-07-15')
    expect(screen.getByText(/Inactive alert for 6 months/)).toBeInTheDocument()
  })

  it('shows legacy miles alert message', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText(/Active alert for 80000 miles/)).toBeInTheDocument()
  })

  it('deletes a record after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailerMaintenanceService.destroy.mockResolvedValue({})
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    // TRL-001 appears in both filter dropdown option and table link
    await screen.findByRole('link', { name: 'TRL-001' })
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(trailerMaintenanceService.destroy).toHaveBeenCalledWith(1))
  })

  it('shows New Record link', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: /New Trailer Maintenance/i })
    expect(link.getAttribute('href')).toBe('/fleet/trailer-maintenance/create')
  })

  it('uses show-all date search by default', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-06-01')
    expect(trailerMaintenanceService.list).toHaveBeenCalledWith({ date_search: '3' })
  })

  it('applies date range only in Maintenance Date mode', async () => {
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-06-01')
    fireEvent.change(screen.getByDisplayValue('Show All (Ignore Dates)'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Search/i }))
    await waitFor(() => expect(trailerMaintenanceService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ date_search: '2', date_from: expect.any(String), date_to: expect.any(String) })
    ))
  })

  it('bulk deletes selected rows after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailerMaintenanceService.bulkDelete.mockResolvedValue({})
    render(<MemoryRouter><TrailerMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-06-01')
    fireEvent.click(screen.getAllByTitle('Select')[0])
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }))
    await waitFor(() => expect(trailerMaintenanceService.bulkDelete).toHaveBeenCalledWith([1]))
  })
})
