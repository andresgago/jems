import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TrailerMaintenanceFormPage from '../TrailerMaintenanceFormPage'

vi.mock('../../../services/trailerMaintenance', () => ({
  trailerMaintenanceService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { list: vi.fn() } }
})

import { trailerMaintenanceService } from '../../../services/trailerMaintenance'
import { trailersService } from '../../../services/trailers'

const trailers = [
  { id: 20, number: 'TRL-001' },
  { id: 21, number: 'TRL-002' },
]

beforeEach(() => {
  vi.clearAllMocks()
  trailersService.list.mockResolvedValue({ data: trailers })
})

const renderCreate = () =>
  render(
    <MemoryRouter initialEntries={['/fleet/trailer-maintenance/create']}>
      <Routes>
        <Route path="/fleet/trailer-maintenance/create" element={<TrailerMaintenanceFormPage />} />
        <Route path="/fleet/trailer-maintenance" element={<div>List</div>} />
      </Routes>
    </MemoryRouter>
  )

const renderEdit = (id = '1') =>
  render(
    <MemoryRouter initialEntries={[`/fleet/trailer-maintenance/${id}/edit`]}>
      <Routes>
        <Route path="/fleet/trailer-maintenance/:id/edit" element={<TrailerMaintenanceFormPage />} />
        <Route path="/fleet/trailer-maintenance" element={<div>List</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('TrailerMaintenanceFormPage - Create', () => {
  it('shows Create Trailer Maintenance heading', async () => {
    renderCreate()
    expect(await screen.findByText(/Create Trailer Maintenance/)).toBeInTheDocument()
  })

  it('renders trailer select with options', async () => {
    renderCreate()
    await screen.findByText(/Create Trailer Maintenance/)
    expect(screen.getByText('TRL-001')).toBeInTheDocument()
    expect(screen.getByText('TRL-002')).toBeInTheDocument()
  })

  it('shows time year/month selects when time alert enabled', async () => {
    renderCreate()
    await screen.findByText(/Create Trailer Maintenance/)
    const timeAlertCb = screen.getByLabelText('Time Alert')
    fireEvent.click(timeAlertCb)
    expect(await screen.findByText('0 Years')).toBeInTheDocument()
    expect(screen.getByText('0 Months')).toBeInTheDocument()
  })

  it('validates trailer is required before submit', async () => {
    renderCreate()
    await screen.findByText(/Create Trailer Maintenance/)
    fireEvent.click(screen.getByText('Create'))
    expect(await screen.findByText('Trailer is required.')).toBeInTheDocument()
    expect(trailerMaintenanceService.create).not.toHaveBeenCalled()
  })

  it('calls create with correct payload types', async () => {
    trailerMaintenanceService.create.mockResolvedValue({ data: {} })
    renderCreate()
    await screen.findByText('TRL-001')
    const trailerSelect = screen.getByText('...').closest('select')
    fireEvent.change(trailerSelect, { target: { value: '20' } })
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
    fireEvent.change(dateInput, { target: { value: '2024-05-10' } })
    fireEvent.change(screen.getByLabelText('Details'), { target: { value: 'Inspection done' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(trailerMaintenanceService.create).toHaveBeenCalled())
    const payload = trailerMaintenanceService.create.mock.calls[0][0]
    expect(payload.trailer).toBe(20)
    expect(payload.date).toBe('2024-05-10')
    expect(payload.miles_alert).toBe(0)
    expect(payload.time_alert).toBe(0)
    expect(typeof payload.miles).toBe('number')
  })

  it('shows miles threshold only when Miles Alert is checked', async () => {
    renderCreate()
    await screen.findByText(/Create Trailer Maintenance/)
    expect(screen.queryByLabelText('Miles')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Miles Alert'))
    expect(screen.getByLabelText('Miles')).toHaveValue(13000)
  })

  it('validates details are required before submit', async () => {
    renderCreate()
    await screen.findByText('TRL-001')
    const trailerSelect = screen.getByText('...').closest('select')
    fireEvent.change(trailerSelect, { target: { value: '20' } })
    fireEvent.click(screen.getByText('Create'))
    expect(await screen.findByText('Details cannot be blank.')).toBeInTheDocument()
    expect(trailerMaintenanceService.create).not.toHaveBeenCalled()
  })

  it('does not show odometer section (trailer has no odometer_start/odometer_current)', async () => {
    renderCreate()
    await screen.findByText(/Create Trailer Maintenance/)
    expect(screen.queryByText('Odometer Start')).not.toBeInTheDocument()
    expect(screen.queryByText('Odometer Current')).not.toBeInTheDocument()
  })
})

describe('TrailerMaintenanceFormPage - Edit', () => {
  beforeEach(() => {
    trailerMaintenanceService.get.mockResolvedValue({
      data: {
        id: 1,
        trailer: 20,
        date: '2024-03-15',
        miles: 75000,
        miles_alert: 0,
        time_alert: 1,
        time_year: 1,
        time_month: 0,
        detail: 'Annual inspection done',
      },
    })
  })

  it('shows Edit heading and pre-populates fields', async () => {
    renderEdit()
    expect(await screen.findByText(/Edit Trailer Maintenance/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Annual inspection done')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-03-15')).toBeInTheDocument()
  })

  it('trailer select is disabled in edit mode', async () => {
    renderEdit()
    await screen.findByText(/Edit Trailer Maintenance/)
    // Labels have no htmlFor; find disabled select among all comboboxes
    const allSelects = screen.getAllByRole('combobox')
    const disabledSelect = allSelects.find((s) => s.disabled)
    expect(disabledSelect).toBeTruthy()
    expect(disabledSelect).toBeDisabled()
  })

  it('calls update without trailer field on submit', async () => {
    trailerMaintenanceService.update.mockResolvedValue({ data: {} })
    renderEdit()
    await screen.findByDisplayValue('Annual inspection done')
    fireEvent.change(screen.getByDisplayValue('Annual inspection done'), { target: { value: 'Updated detail' } })
    fireEvent.click(screen.getByText('Update'))
    await waitFor(() => expect(trailerMaintenanceService.update).toHaveBeenCalled())
    const payload = trailerMaintenanceService.update.mock.calls[0][1]
    expect(payload.detail).toBe('Updated detail')
    expect(payload.trailer).toBeUndefined()
  })
})
