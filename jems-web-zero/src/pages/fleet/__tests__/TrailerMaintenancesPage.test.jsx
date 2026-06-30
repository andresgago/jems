import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrailerMaintenancesPage from '../TrailerMaintenancesPage'

vi.mock('../../../services/trailerMaintenance', () => ({
  trailerMaintenanceService: {
    list: vi.fn(),
    destroy: vi.fn(),
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
    expect(screen.getByText(/6 mo/)).toBeInTheDocument()
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
    const link = await screen.findByRole('link', { name: /New Record/i })
    expect(link.getAttribute('href')).toBe('/fleet/trailer-maintenance/create')
  })
})
