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
  return { ...actual, trucksService: { list: vi.fn(), get: vi.fn() } }
})

import { truckMaintenanceService } from '../../../services/truckMaintenance'
import { trucksService } from '../../../services/trucks'

const trucks = [
  { id: 1, number: 'T-100', odometer_current: 125000 },
  { id: 2, number: 'T-200', odometer_current: 88000 },
]

beforeEach(() => {
  vi.clearAllMocks()
  trucksService.list.mockResolvedValue({ data: trucks })
  trucksService.get.mockResolvedValue({ data: trucks[0] })
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

  it('validates detail is required before submit', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    // Select a truck so truck validation passes
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '1' } })
    fireEvent.click(screen.getByText('Create'))
    expect(await screen.findByText('Detail is required.')).toBeInTheDocument()
    expect(truckMaintenanceService.create).not.toHaveBeenCalled()
  })

  it('detail label shows required asterisk', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    const detailLabel = screen.getByText('Detail', { selector: 'label' })
    expect(detailLabel.querySelector('.text-danger')).not.toBeNull()
  })

  it('shows status select with Pending and Done options', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    expect(screen.getByRole('option', { name: 'Pending' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Done' })).toBeInTheDocument()
  })

  it('status defaults to Pending on create', async () => {
    renderCreate()
    await screen.findByText(/Create Truck Maintenance/)
    const statusSelect = screen.getByDisplayValue('Pending')
    expect(statusSelect).toBeInTheDocument()
  })

  it('calls create with correct payload and navigates', async () => {
    truckMaintenanceService.create.mockResolvedValue({ data: { id: 99 } })
    renderCreate()
    await screen.findByText('T-100')
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '1' } })
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
    fireEvent.change(dateInput, { target: { value: '2024-05-10' } })
    fireEvent.change(screen.getByPlaceholderText('Describe the maintenance work…'), {
      target: { value: 'Oil change done' },
    })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(truckMaintenanceService.create).toHaveBeenCalled())
    const payload = truckMaintenanceService.create.mock.calls[0][0]
    expect(payload.truck).toBe(1)
    expect(payload.date).toBe('2024-05-10')
    expect(payload.detail).toBe('Oil change done')
    expect(payload.is_done).toBe(false)
    expect(payload.miles_alert).toBe(0)
    expect(payload.time_alert).toBe(0)
    expect(typeof payload.maintenance_miles).toBe('number')
  })

  it('sends is_done=true when Done is selected', async () => {
    truckMaintenanceService.create.mockResolvedValue({ data: { id: 99 } })
    renderCreate()
    await screen.findByText('T-100')
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '1' } })
    fireEvent.change(screen.getByPlaceholderText('Describe the maintenance work…'), {
      target: { value: 'Oil change done' },
    })
    const statusSelect = screen.getByDisplayValue('Pending')
    fireEvent.change(statusSelect, { target: { value: 'true' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(truckMaintenanceService.create).toHaveBeenCalled())
    const payload = truckMaintenanceService.create.mock.calls[0][0]
    expect(payload.is_done).toBe(true)
  })

  // ── odometer auto-populate ────────────────────────────────────────────────

  it('auto-populates odometer_start from truck odometer_current when truck is selected', async () => {
    trucksService.get.mockResolvedValue({ data: { id: 1, number: 'T-100', odometer_current: 125000 } })
    renderCreate()
    await screen.findByText('T-100')
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '1' } })
    await waitFor(() => expect(trucksService.get).toHaveBeenCalledWith('1'))
    // odometer_start input should be populated with 125000
    await waitFor(() => {
      expect(screen.getByDisplayValue('125000')).toBeInTheDocument()
    })
  })

  it('does not call trucksService.get when truck is cleared', async () => {
    renderCreate()
    await screen.findByText('T-100')
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '' } })
    expect(trucksService.get).not.toHaveBeenCalled()
  })

  it('does not fail if truck fetch fails during odometer auto-populate', async () => {
    trucksService.get.mockRejectedValue(new Error('network'))
    renderCreate()
    await screen.findByText('T-100')
    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '1' } })
    await waitFor(() => expect(trucksService.get).toHaveBeenCalled())
    // Should not crash — form is still usable
    expect(screen.getByText(/Create Truck Maintenance/)).toBeInTheDocument()
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
    // is_done=false → Status select shows Pending
    expect(screen.getByDisplayValue('Pending')).toBeInTheDocument()
  })

  it('truck select is disabled in edit mode', async () => {
    renderEdit()
    await screen.findByText(/Edit Truck Maintenance/)
    const allSelects = screen.getAllByRole('combobox')
    const disabledSelect = allSelects.find((s) => s.disabled)
    expect(disabledSelect).toBeTruthy()
    expect(disabledSelect).toBeDisabled()
  })

  it('does not auto-populate odometer_start in edit mode when truck changes', async () => {
    renderEdit()
    await screen.findByDisplayValue('Oil change service')
    // trucksService.get should NOT be called in edit mode
    expect(trucksService.get).not.toHaveBeenCalled()
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

  it('validates detail is required in edit mode', async () => {
    truckMaintenanceService.update.mockResolvedValue({ data: {} })
    renderEdit()
    await screen.findByDisplayValue('Oil change service')
    fireEvent.change(screen.getByDisplayValue('Oil change service'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Update'))
    expect(await screen.findByText('Detail is required.')).toBeInTheDocument()
    expect(truckMaintenanceService.update).not.toHaveBeenCalled()
  })
})
