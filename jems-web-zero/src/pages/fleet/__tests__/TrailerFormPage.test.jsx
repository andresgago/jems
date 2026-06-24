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
  return { ...actual, trailersService: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }
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
  it('requires the trailer number before submitting', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Create Trailer/i }))
    await waitFor(() => expect(getInput('Number')).toHaveClass('is-invalid'))
    expect(trailersService.create).not.toHaveBeenCalled()
  })

  it('serializes FK as id, empty dates as null, numbers as Number', async () => {
    trailersService.create.mockResolvedValue({ data: { id: 10 } })
    renderForm()

    fireEvent.change(getInput('Number'), { target: { value: 'TRL-999' } })
    fireEvent.change(getInput('Year'), { target: { value: '2023' } })
    // Select Type option (53ft Dry Van)
    fireEvent.change(getInput('Type'), { target: { value: '1' } })
    // Carrier
    fireEvent.change(getInput('Carrier'), { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Trailer/i }))

    await waitFor(() => expect(trailersService.create).toHaveBeenCalled())

    const payload = trailersService.create.mock.calls[0][0]
    expect(payload.number).toBe('TRL-999')
    expect(payload.year).toBe(2023)          // coerced to Number
    expect(payload.trailer_type).toBe('1')   // FK stays as string-id (sent to API)
    expect(payload.annual_inspection_expiration).toBeNull() // empty date → null
    expect(payload.carrier).toBe('3')
    expect(payload.status).toBe(1)           // coerced to Number
  })

  it('renders Rented checkbox with default unchecked', () => {
    renderForm()
    // Label has no htmlFor — navigate via DOM parent (project-wide convention)
    const label = screen.getByText('Rented', { selector: 'label' })
    const checkbox = label.parentElement.querySelector('input[type="checkbox"]')
    expect(checkbox).not.toBeChecked()
  })

  it('renders Type select with the seeded option', () => {
    renderForm()
    expect(screen.getByRole('option', { name: '53ft Dry Van' })).toBeInTheDocument()
  })

  it('renders Carrier select with the seeded option', () => {
    renderForm()
    expect(screen.getByRole('option', { name: 'Jobee Express' })).toBeInTheDocument()
  })
})

describe('TrailerFormPage (edit)', () => {
  it('pre-populates form from API and sends PATCH on save', async () => {
    trailersService.get.mockResolvedValue({
      data: {
        id: 7, number: 'TRL-007', vin: 'VIN007', year: 2021,
        trailer_type: 1, status: 1, width: 0, height: 0,
        plate_number: 'TX-777', plate_state: null,
        annual_inspection_expiration: '2026-01-15',
        purchase_date: null, purchase_cost: 0,
        is_rented: false, loss_payee: '',
        owner: null, carrier: null,
        carrier_start_date: null, carrier_end_date: null, carrier_end_reason: '',
      },
    })
    trailersService.update.mockResolvedValue({ data: { id: 7 } })

    renderForm('/fleet/trailers/7/edit')
    await waitFor(() => expect(screen.getByDisplayValue('TRL-007')).toBeInTheDocument())

    expect(getInput('Number')).toHaveValue('TRL-007')
    expect(getInput('VIN')).toHaveValue('VIN007')

    fireEvent.change(getInput('Number'), { target: { value: 'TRL-007-UPD' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() => expect(trailersService.update).toHaveBeenCalledWith('7', expect.objectContaining({ number: 'TRL-007-UPD' })))
  })
})
