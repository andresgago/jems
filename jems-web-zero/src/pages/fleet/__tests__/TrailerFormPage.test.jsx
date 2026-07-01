import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TrailerFormPage from '../TrailerFormPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/fleet/trailer-types/') return [{ id: 1, name: '53ft Dry Van' }]
    if (url === '/carriers/') return [{ id: 3, name: 'Jobee Express' }]
    if (url === '/fleet/owners/') return [{ id: 2, full_name: 'Carlos Morales' }]
    if (url === '/locations/states/') return [{ id: 5, name: 'Texas' }]
    return []
  }),
}))

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { get: vi.fn(), create: vi.fn(), update: vi.fn(), uploadFile: vi.fn() } }
})

import { trailersService } from '../../../services/trailers'

function getInput(labelText) {
  return screen.getByText(labelText, { selector: 'label' }).parentElement.querySelector('input, select, textarea')
}

function renderForm(path = '/fleet/trailers/create') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/fleet/trailers/create" element={<TrailerFormPage />} />
        <Route path="/fleet/trailers/:id/edit" element={<TrailerFormPage />} />
        <Route path="/fleet/trailers/:id" element={<div>Trailer detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('TrailerFormPage (create)', () => {
  it('shows the legacy "Create new Trailer" title', () => {
    renderForm()
    expect(screen.getByText('Create new Trailer')).toBeInTheDocument()
  })

  it('requires the trailer number before submitting', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() => expect(getInput('Number')).toHaveClass('is-invalid'))
    expect(trailersService.create).not.toHaveBeenCalled()
  })

  it('serializes FK as id, empty dates as null, numbers as Number, is_rented as boolean', async () => {
    trailersService.create.mockResolvedValue({ data: { id: 10 } })
    renderForm()

    fireEvent.change(getInput('Number'), { target: { value: 'TRL-999' } })
    fireEvent.change(getInput('Year'), { target: { value: '2023' } })
    fireEvent.change(getInput('Type'), { target: { value: '1' } })
    fireEvent.change(getInput('Carrier'), { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(trailersService.create).toHaveBeenCalled())

    const payload = trailersService.create.mock.calls[0][0]
    expect(payload.number).toBe('TRL-999')
    expect(payload.year).toBe(2023)
    expect(payload.trailer_type).toBe('1')
    expect(payload.annual_inspection_expiration).toBeNull()
    expect(payload.carrier).toBe('3')
    expect(payload.status).toBe(1)
    expect(payload.is_rented).toBe(false)
  })

  it('renders Rent as a NOT/YES select, defaulting to NOT', () => {
    renderForm()
    const select = getInput('Rent')
    expect(select).toHaveValue('0')
    expect(screen.getByRole('option', { name: 'NOT' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'YES' })).toBeInTheDocument()
  })

  it('renders Type select with the seeded option', () => {
    renderForm()
    expect(screen.getByRole('option', { name: '53ft Dry Van' })).toBeInTheDocument()
  })

  it('renders Carrier select with the seeded option', () => {
    renderForm()
    expect(screen.getByRole('option', { name: 'Jobee Express' })).toBeInTheDocument()
  })

  it('renders inline file pickers for Agreement, Annual Inspection, and Registration', () => {
    renderForm()
    expect(screen.getByLabelText('Agreement')).toBeInTheDocument()
    expect(screen.getByLabelText('Annual Inspection')).toBeInTheDocument()
    expect(screen.getByLabelText('Registration')).toBeInTheDocument()
  })
})

describe('TrailerFormPage (edit)', () => {
  it('shows the legacy "Update Trailer" title and pre-populates form from API', async () => {
    trailersService.get.mockResolvedValue({
      data: {
        id: 7, number: 'TRL-007', vin: 'VIN007', year: 2021,
        trailer_type: 1, status: 1, width: 0, height: 0,
        plate_number: 'TX-777', plate_state: null,
        annual_inspection_expiration: '2026-01-15',
        purchase_date: null, purchase_cost: 0,
        is_rented: true, loss_payee: '',
        owner: null, carrier: null,
        carrier_start_date: null, carrier_end_date: null, carrier_end_reason: '',
      },
    })
    trailersService.update.mockResolvedValue({ data: { id: 7 } })

    renderForm('/fleet/trailers/7/edit')
    await waitFor(() => expect(screen.getByDisplayValue('TRL-007')).toBeInTheDocument())

    expect(screen.getByText('Update Trailer')).toBeInTheDocument()
    expect(getInput('Number')).toHaveValue('TRL-007')
    expect(getInput('Vin Number')).toHaveValue('VIN007')
    expect(getInput('Rent')).toHaveValue('1')

    fireEvent.change(getInput('Number'), { target: { value: 'TRL-007-UPD' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(trailersService.update).toHaveBeenCalledWith('7', expect.objectContaining({ number: 'TRL-007-UPD', is_rented: true })))
  })
})
