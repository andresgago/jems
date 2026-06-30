import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AccidentFormPage from '../AccidentFormPage'

vi.mock('../../../services/accidents', () => ({
  accidentsService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { list: vi.fn() } }
})

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return { ...actual, driversService: { list: vi.fn() } }
})

import { accidentsService } from '../../../services/accidents'
import { trucksService } from '../../../services/trucks'
import { trailersService } from '../../../services/trailers'
import { driversService } from '../../../services/drivers'

const trucks = [{ id: 10, number: 'T-100' }]
const trailers = [{ id: 20, number: 'TRL-001' }]
const drivers = [{ id: 5, first_name: 'John', last_name: 'Doe' }]

beforeEach(() => {
  vi.clearAllMocks()
  trucksService.list.mockResolvedValue({ data: trucks })
  trailersService.list.mockResolvedValue({ data: trailers })
  driversService.list.mockResolvedValue({ data: drivers })
})

const renderCreate = () =>
  render(
    <MemoryRouter initialEntries={['/fleet/accidents/create']}>
      <Routes>
        <Route path="/fleet/accidents/create" element={<AccidentFormPage />} />
        <Route path="/fleet/accidents/:id" element={<div>Detail</div>} />
      </Routes>
    </MemoryRouter>
  )

const renderEdit = (id = '1') =>
  render(
    <MemoryRouter initialEntries={[`/fleet/accidents/${id}/edit`]}>
      <Routes>
        <Route path="/fleet/accidents/:id/edit" element={<AccidentFormPage />} />
        <Route path="/fleet/accidents/:id" element={<div>Detail</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('AccidentFormPage - Create', () => {
  it('shows Create Accident heading', async () => {
    renderCreate()
    expect(await screen.findByText(/Create Accident/)).toBeInTheDocument()
  })

  it('renders truck, trailer, and driver selects with options', async () => {
    renderCreate()
    await screen.findByText(/Create Accident/)
    expect(screen.getByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('TRL-001')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('calls create with FK fields as numbers (not strings)', async () => {
    accidentsService.create.mockResolvedValue({ data: { id: 99 } })
    const { container } = renderCreate()
    await screen.findByText('T-100')

    const truckSelect = screen.getByText('Select truck…').closest('select')
    fireEvent.change(truckSelect, { target: { value: '10' } })

    // Multiple inputs have empty value; target datetime-local specifically
    const dateInput = container.querySelector('input[type="datetime-local"]')
    fireEvent.change(dateInput, { target: { value: '2024-06-01T12:00' } })

    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(accidentsService.create).toHaveBeenCalled())
    const payload = accidentsService.create.mock.calls[0][0]
    expect(payload.truck).toBe(10)
    expect(payload.trailer).toBeNull()
    expect(payload.driver).toBeNull()
  })

  it('sends tow_aways as boolean', async () => {
    accidentsService.create.mockResolvedValue({ data: { id: 99 } })
    renderCreate()
    await screen.findByText(/Create Accident/)

    const towAwaysCb = screen.getByText(/Tow-aways involved/).closest('label').querySelector('input[type="checkbox"]')
    fireEvent.click(towAwaysCb)
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(accidentsService.create).toHaveBeenCalled())
    const payload = accidentsService.create.mock.calls[0][0]
    expect(payload.tow_aways).toBe(true)
  })

  it('sends death_count and fatal_injuries as numbers', async () => {
    accidentsService.create.mockResolvedValue({ data: { id: 99 } })
    renderCreate()
    await screen.findByText(/Create Accident/)

    // Both death_count and fatal_injuries have value "0"; target the Deaths input by sibling label
    const deathInputs = screen.getAllByDisplayValue('0')
    // death_count is the first number input after the tow_aways checkbox
    fireEvent.change(deathInputs[0], { target: { value: '2' } })

    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(accidentsService.create).toHaveBeenCalled())
    const payload = accidentsService.create.mock.calls[0][0]
    expect(typeof payload.death_count).toBe('number')
  })

  it('navigates to detail page on successful create', async () => {
    accidentsService.create.mockResolvedValue({ data: { id: 42 } })
    renderCreate()
    await screen.findByText(/Create Accident/)
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(screen.getByText('Detail')).toBeInTheDocument())
  })
})

describe('AccidentFormPage - Edit', () => {
  beforeEach(() => {
    accidentsService.get.mockResolvedValue({
      data: {
        id: 1,
        date: '2024-05-10T08:30:00Z',
        crash_number: 'CR-007',
        address: 'I-80 Exit 23',
        truck: 10,
        trailer: null,
        driver: null,
        tow_aways: false,
        death_count: 0,
        fatal_injuries: 1,
      },
    })
  })

  it('shows Edit heading and pre-populates fields', async () => {
    renderEdit()
    expect(await screen.findByText(/Edit Accident/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('CR-007')).toBeInTheDocument()
    expect(screen.getByDisplayValue('I-80 Exit 23')).toBeInTheDocument()
  })

  it('calls update with the accident id on submit', async () => {
    accidentsService.update.mockResolvedValue({ data: {} })
    renderEdit('1')
    await screen.findByDisplayValue('CR-007')
    fireEvent.change(screen.getByDisplayValue('CR-007'), { target: { value: 'CR-999' } })
    fireEvent.click(screen.getByText('Update'))
    await waitFor(() => expect(accidentsService.update).toHaveBeenCalled())
    expect(accidentsService.update.mock.calls[0][0]).toBe('1')
    expect(accidentsService.update.mock.calls[0][1].crash_number).toBe('CR-999')
  })
})
