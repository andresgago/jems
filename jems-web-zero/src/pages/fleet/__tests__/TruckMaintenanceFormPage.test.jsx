import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TruckMaintenanceFormPage from '../TruckMaintenanceFormPage'

vi.mock('../../../services/truckMaintenance', () => ({
  truckMaintenanceService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

import { truckMaintenanceService } from '../../../services/truckMaintenance'
import { trucksService } from '../../../services/trucks'

const trucks = [
  { id: 1, number: 'T-100' },
  { id: 2, number: 'T-200' },
]

beforeEach(() => {
  vi.clearAllMocks()
  trucksService.list.mockResolvedValue({ data: trucks })
})

const renderCreate = () =>
  render(
    <MemoryRouter initialEntries={['/fleet/truck-maintenance/create']}>
      <Routes>
        <Route path="/fleet/truck-maintenance/create" element={<TruckMaintenanceFormPage />} />
        <Route path="/fleet/truck-maintenance" element={<div>List</div>} />
      </Routes>
    </MemoryRouter>
  )

const renderEdit = (id = '1') =>
  render(
    <MemoryRouter initialEntries={[`/fleet/truck-maintenance/${id}/edit`]}>
      <Routes>
        <Route path="/fleet/truck-maintenance/:id/edit" element={<TruckMaintenanceFormPage />} />
        <Route path="/fleet/truck-maintenance" element={<div>List</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('TruckMaintenanceFormPage - Create', () => {
  it('shows Create Truck Maintenance heading', async () => {
    renderCreate()
    expect(await screen.findByText(/Create Truck Maintenance/)).toBeInTheDocument()
  })

  it('renders truck select with options', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    expect(screen.getByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })

  it('shows default maintenance_miles of 13000 when miles alert enabled', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    const milesAlertCb = screen.getByText('Enable miles-based alert').closest('label').querySelector('input[type="checkbox"]')
    fireEvent.click(milesAlertCb)
    const alertInput = await screen.findByDisplayValue('13000')
    expect(alertInput).toBeInTheDocument()
  })

  it('shows time year/month selects when time alert enabled', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    const timeAlertCb = screen.getByText('Enable time-based alert').closest('label').querySelector('input[type="checkbox"]')
    fireEvent.click(timeAlertCb)
    expect(await screen.findByText('0 Years')).toBeInTheDocument()
    expect(screen.getByText('0 Months')).toBeInTheDocument()
  })

  it('validates truck is required before submit', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    fireEvent.click(screen.getByText('Create'))
    expect(await screen.findByText('Truck is required.')).toBeInTheDocument()
    expect(truckMaintenanceService.create).not.toHaveBeenCalled()
  })

  it('calls create with correct payload and navigates', async () => {
    truckMaintenanceService.create.mockResolvedValue({ data: { id: 99 } })
    renderCreate()
    await screen.findByText('T-100')
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '1' } })
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
    fireEvent.change(dateInput, { target: { value: '2024-05-10' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(truckMaintenanceService.create).toHaveBeenCalled())
    const payload = truckMaintenanceService.create.mock.calls[0][0]
    expect(payload.truck).toBe(1)
    expect(payload.date).toBe('2024-05-10')
    expect(payload.miles_alert).toBe(0)
    expect(payload.time_alert).toBe(0)
    expect(typeof payload.maintenance_miles).toBe('number')
  })
})

describe('TruckMaintenanceFormPage - Edit', () => {
  beforeEach(() => {
    truckMaintenanceService.get.mockResolvedValue({
      data: {
        id: 1,
        truck: 1,
        date: '2024-03-01',
        miles_alert: 1,
        maintenance_miles: 13000,
        time_alert: 0,
        time_year: 0,
        time_month: 0,
        odometer_start: 100000,
        odometer_current: 113000,
        is_done: false,
        driven_miles: 0,
        detail: 'Oil change service',
      },
    })
  })

  it('shows Edit heading and pre-populates fields', async () => {
    renderEdit()
    expect(await screen.findByText(/Edit Truck Maintenance/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Oil change service')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-03-01')).toBeInTheDocument()
  })

  it('truck select is disabled in edit mode', async () => {
    renderEdit()
    await screen.findByText(/Edit Truck Maintenance/)
    // Labels have no htmlFor so combobox name lookup won't work; find disabled select directly
    const allSelects = screen.getAllByRole('combobox')
    const disabledSelect = allSelects.find((s) => s.disabled)
    expect(disabledSelect).toBeTruthy()
    expect(disabledSelect).toBeDisabled()
  })

  it('calls update without truck field on submit', async () => {
    truckMaintenanceService.update.mockResolvedValue({ data: {} })
    renderEdit()
    await screen.findByDisplayValue('Oil change service')
    fireEvent.change(screen.getByDisplayValue('Oil change service'), { target: { value: 'Full tune-up' } })
    fireEvent.click(screen.getByText('Update'))
    await waitFor(() => expect(truckMaintenanceService.update).toHaveBeenCalled())
    const payload = truckMaintenanceService.update.mock.calls[0][1]
    expect(payload.detail).toBe('Full tune-up')
    expect(payload.truck).toBeUndefined()
  })
})
