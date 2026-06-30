import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TruckMaintenancesPage from '../TruckMaintenancesPage'

vi.mock('../../../services/truckMaintenance', () => ({
  truckMaintenanceService: {
    list: vi.fn(),
    destroy: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

import { truckMaintenanceService } from '../../../services/truckMaintenance'
import { trucksService } from '../../../services/trucks'

const records = [
  {
    id: 1,
    truck: 10,
    truck_number: 'T-100',
    truck_vin: '1ABC',
    date: '2024-03-01',
    miles_alert: 1,
    maintenance_miles: 13000,
    time_alert: 0,
    time_year: 0,
    time_month: 0,
    detail: 'Oil change',
  },
  {
    id: 2,
    truck: 11,
    truck_number: 'T-200',
    truck_vin: '2DEF',
    date: '2024-04-15',
    miles_alert: 0,
    maintenance_miles: 0,
    time_alert: 1,
    time_year: 1,
    time_month: 6,
    detail: 'Tire rotation',
  },
]

const trucks = [
  { id: 10, number: 'T-100' },
  { id: 11, number: 'T-200' },
]

beforeEach(() => {
  vi.clearAllMocks()
  truckMaintenanceService.list.mockResolvedValue({ data: records })
  trucksService.list.mockResolvedValue({ data: trucks })
})

describe('TruckMaintenancesPage', () => {
  it('renders maintenance records', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText('2024-03-01')).toBeInTheDocument()
    expect(screen.getByText('2024-04-15')).toBeInTheDocument()
  })

  it('shows truck number linked to truck detail', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: 'T-100' })
    expect(link.getAttribute('href')).toBe('/fleet/trucks/10')
  })

  it('shows miles alert badge when enabled', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    expect(screen.getByText(/13,000 mi/)).toBeInTheDocument()
  })

  it('shows time alert badge when enabled', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-04-15')
    expect(screen.getByText(/1 yr/)).toBeInTheDocument()
  })

  it('shows dash when alert disabled', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    // Tire rotation row has no miles alert → '—' for miles
    const cells = screen.getAllByText('—')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('deletes a record after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    truckMaintenanceService.destroy.mockResolvedValue({})
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    // T-100 appears in both the filter dropdown option and the table link; wait for the link
    await screen.findByRole('link', { name: 'T-100' })
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(truckMaintenanceService.destroy).toHaveBeenCalledWith(1))
  })

  it('does not delete when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByRole('link', { name: 'T-100' })
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(truckMaintenanceService.destroy).not.toHaveBeenCalled()
  })

  it('shows New Record link', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: /New Record/i })
    expect(link.getAttribute('href')).toBe('/fleet/truck-maintenance/create')
  })
})
