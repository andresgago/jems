import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TruckMaintenancesPage from '../TruckMaintenancesPage'

vi.mock('../../../services/truckMaintenance', () => ({
  truckMaintenanceService: {
    list: vi.fn(),
    destroy: vi.fn(),
    bulkDelete: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

vi.mock('../../../components/DateRangePicker', () => ({
  default: ({ start, end, onApply }) => (
    <div data-testid="date-range-picker">
      <button onClick={() => onApply({ start: '2024-01-01', end: '2024-12-31' })}>
        Apply dates
      </button>
      <span>{start} {end}</span>
    </div>
  ),
}))

import { truckMaintenanceService } from '../../../services/truckMaintenance'
import { trucksService } from '../../../services/trucks'

const records = [
  {
    id: 1,
    truck: 10,
    truck_number: 'T-100',
    truck_vin: '1ABC',
    truck_odometer_current: 130000,
    date: '2024-03-01',
    is_done: false,
    miles_alert: 1,
    maintenance_miles: 13000,
    time_alert: 0,
    time_year: 0,
    time_month: 0,
    odometer_start: 100000,
    odometer_current: 113000,
    driven_miles: 13000,
    detail: 'Oil change',
  },
  {
    id: 2,
    truck: 11,
    truck_number: 'T-200',
    truck_vin: '2DEF',
    truck_odometer_current: 90000,
    date: '2024-04-15',
    is_done: true,
    miles_alert: 0,
    maintenance_miles: 0,
    time_alert: 1,
    time_year: 1,
    time_month: 6,
    odometer_start: 0,
    odometer_current: 0,
    driven_miles: 0,
    detail: 'Tire rotation',
  },
]

const recordsSameTruck = [
  {
    id: 3,
    truck: 10,
    truck_number: 'T-100',
    truck_vin: '1ABC',
    truck_odometer_current: 130000,
    date: '2024-06-01',
    is_done: false,
    miles_alert: 0,
    maintenance_miles: 0,
    time_alert: 0,
    time_year: 0,
    time_month: 0,
    odometer_start: 0,
    odometer_current: 0,
    driven_miles: 0,
    detail: 'Latest service',
  },
  {
    id: 1,
    truck: 10,
    truck_number: 'T-100',
    truck_vin: '1ABC',
    truck_odometer_current: 130000,
    date: '2024-03-01',
    is_done: true,
    miles_alert: 1,
    maintenance_miles: 13000,
    time_alert: 0,
    time_year: 0,
    time_month: 0,
    odometer_start: 100000,
    odometer_current: 113000,
    driven_miles: 13000,
    detail: 'Oil change',
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

  it('shows # serial column and separate ID column header', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText('#')).toBeInTheDocument()
    // ID label is in the th above the input
    expect(screen.getByText('ID')).toBeInTheDocument()
  })

  it('links truck number and shows VIN in the same cell', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: 'T-100' })
    expect(link.getAttribute('href')).toBe('/fleet/trucks/10')
    expect(link.closest('td')).toHaveTextContent('T-100 - 1ABC')
  })

  it('ID column links to truck detail page', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    const idLink = screen.getByRole('link', { name: '1' })
    expect(idLink.getAttribute('href')).toBe('/fleet/trucks/10')
  })

  it('shows view truck eye icon in Actions column', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    const viewLinks = screen.getAllByTitle('View truck')
    expect(viewLinks[0].getAttribute('href')).toBe('/fleet/trucks/10')
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

  it('deletes a record after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    truckMaintenanceService.destroy.mockResolvedValue({})
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(truckMaintenanceService.destroy).toHaveBeenCalledWith(1))
  })

  it('does not delete when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(truckMaintenanceService.destroy).not.toHaveBeenCalled()
  })

  it('shows New Truck Maintenance link', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: /New Truck Maintenance/i })
    expect(link.getAttribute('href')).toBe('/fleet/truck-maintenance/create')
  })

  it('uses DateRangePicker for date filtering', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByTestId('date-range-picker')
    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
  })

  it('calls list with date params when Search is submitted', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getByText('Apply dates'))
    fireEvent.click(screen.getByRole('button', { name: /Search/i }))
    await waitFor(() => {
      const calls = truckMaintenanceService.list.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall).toMatchObject({ date_from: '2024-01-01', date_to: '2024-12-31' })
    })
  })

  // ── Inline header filters ─────────────────────────────────────────────────

  it('Truck label and select are in the table header', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    expect(screen.getByText('Truck', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'T-100' })).toBeInTheDocument()
  })

  it('filters records by truck when inline select changes', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-04-15')
    const truckSelect = screen.getAllByRole('combobox').find(
      (s) => s.querySelector && s.options?.[1]?.text === 'T-100'
    ) || screen.getAllByRole('combobox')[0]
    fireEvent.change(truckSelect, { target: { value: '10' } })
    expect(await screen.findByText('2024-03-01')).toBeInTheDocument()
    expect(screen.queryByText('2024-04-15')).not.toBeInTheDocument()
  })

  it('filters records by ID when inline ID input changes', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-04-15')
    const idInput = screen.getByPlaceholderText('ID')
    fireEvent.change(idInput, { target: { value: '2' } })
    expect(await screen.findByText('2024-04-15')).toBeInTheDocument()
    expect(screen.queryByText('2024-03-01')).not.toBeInTheDocument()
  })

  // ── is_done / Status badge ────────────────────────────────────────────────

  it('shows Is Done column header', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText('Is Done')).toBeInTheDocument()
  })

  it('shows Current badge for is_done=false record', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('shows Done badge for is_done=true record', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-04-15')
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  // ── Latest per-truck indicator ────────────────────────────────────────────

  it('shows wrench icon only on the latest record per truck', async () => {
    truckMaintenanceService.list.mockResolvedValue({ data: recordsSameTruck })
    const { container } = render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-06-01')
    const tbody = container.querySelector('tbody')
    const icons = tbody.querySelectorAll('[title="Latest maintenance for this truck"]')
    expect(icons).toHaveLength(1)
  })

  it('marks the correct record as latest when same truck has multiple records', async () => {
    truckMaintenanceService.list.mockResolvedValue({ data: recordsSameTruck })
    const { container } = render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-06-01')
    const tbody = container.querySelector('tbody')
    const [icon] = tbody.querySelectorAll('[title="Latest maintenance for this truck"]')
    expect(icon.closest('tr')).toHaveTextContent('2024-06-01')
  })

  it('marks each truck\'s latest record independently', async () => {
    const { container } = render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    const tbody = container.querySelector('tbody')
    const icons = tbody.querySelectorAll('[title="Latest maintenance for this truck"]')
    expect(icons).toHaveLength(2)
  })

  // ── Odometer columns ──────────────────────────────────────────────────────

  it('shows Odometer at maintenance column header', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText('Odometer at maintenance')).toBeInTheDocument()
  })

  it('shows Current Odometer column header', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    expect(await screen.findByText('Current Odometer')).toBeInTheDocument()
  })

  it('shows previous/current/traveled in odometer cell', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    expect(screen.getByText('Previous: 100,000')).toBeInTheDocument()
    expect(screen.getByText('Current: 113,000')).toBeInTheDocument()
    expect(screen.getByText('Traveled: 13,000')).toBeInTheDocument()
  })

  // ── Row checkboxes ────────────────────────────────────────────────────────

  it('renders a checkbox for each row', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    const checkboxes = screen.getAllByTitle('Select')
    expect(checkboxes).toHaveLength(2)
  })

  it('select-all enables Delete All button and checks all rows', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getByTitle('Select all'))
    const btn = screen.getByRole('button', { name: /Delete All/i })
    expect(btn).not.toBeDisabled()
    const checkboxes = screen.getAllByTitle('Select')
    checkboxes.forEach((cb) => expect(cb).toBeChecked())
  })

  it('Delete All button is disabled when nothing selected', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    const btn = screen.getByRole('button', { name: /Delete All/i })
    expect(btn).toBeDisabled()
  })

  // ── Bulk delete ───────────────────────────────────────────────────────────

  it('calls bulkDelete with selected ids after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    truckMaintenanceService.bulkDelete.mockResolvedValue({})
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getByTitle('Select all'))
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }))
    await waitFor(() => {
      expect(truckMaintenanceService.bulkDelete).toHaveBeenCalled()
      const ids = truckMaintenanceService.bulkDelete.mock.calls[0][0]
      expect(ids).toContain(1)
      expect(ids).toContain(2)
    })
  })

  it('does not call bulkDelete when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getByTitle('Select all'))
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }))
    expect(truckMaintenanceService.bulkDelete).not.toHaveBeenCalled()
  })

  // ── Reset ─────────────────────────────────────────────────────────────────

  it('Reset button triggers a fresh list fetch', async () => {
    render(<MemoryRouter><TruckMaintenancesPage /></MemoryRouter>)
    await screen.findByText('2024-03-01')
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }))
    await waitFor(() => expect(truckMaintenanceService.list.mock.calls.length).toBeGreaterThanOrEqual(2))
  })
})
