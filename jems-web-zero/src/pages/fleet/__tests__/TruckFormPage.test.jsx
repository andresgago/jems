import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TruckFormPage from '../TruckFormPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/fleet/truck-types/') return [{ id: 1, name: 'Sleeper' }]
    if (url === '/carriers/') return [{ id: 3, name: 'Jobee Express' }]
    return []
  }),
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }
})

import { trucksService } from '../../../services/trucks'

function getInput(labelText) {
  return screen.getByText(labelText, { selector: 'label' }).parentElement.querySelector('input, select, textarea')
}

function renderForm(path = '/fleet/trucks/create') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/fleet/trucks/create" element={<TruckFormPage />} />
        <Route path="/fleet/trucks/:id/edit" element={<TruckFormPage />} />
        <Route path="/fleet/trucks/:id" element={<div>Truck detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('TruckFormPage (create)', () => {
  it('requires the truck number before submitting', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Create Truck/i }))
    await waitFor(() => expect(getInput('Number')).toHaveClass('is-invalid'))
    expect(trucksService.create).not.toHaveBeenCalled()
  })

  it('serializes FK as id, empty dates as null, numbers as Number, text financials as strings', async () => {
    trucksService.create.mockResolvedValue({ data: { id: 99 } })
    renderForm()

    fireEvent.change(getInput('Number'), { target: { value: 'T-500' } })
    fireEvent.change(getInput('Type'), { target: { value: '1' } })
    fireEvent.change(getInput('Carrier'), { target: { value: '3' } })
    fireEvent.change(getInput('Gross Weight'), { target: { value: '35000' } })
    fireEvent.change(getInput('Interest Rate'), { target: { value: '4.5%' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Truck/i }))

    await waitFor(() => expect(trucksService.create).toHaveBeenCalledTimes(1))
    const payload = trucksService.create.mock.calls[0][0]
    expect(payload).toMatchObject({
      number: 'T-500',
      truck_type: '1',
      carrier: '3',
      gross_weight: 35000,
      interest_rate: '4.5%', // CharField in the model — must stay a string
      status: 1,
    })
    expect(payload.make).toBeNull()
    expect(payload.avi_expiration).toBeNull()
  })
})

describe('TruckFormPage (edit)', () => {
  it('prefills the form from the fetched truck', async () => {
    trucksService.get.mockResolvedValue({
      data: { id: 5, number: 'T-900', vin: 'ZZZ', status: 0, make: null },
    })
    renderForm('/fleet/trucks/5/edit')
    await waitFor(() => expect(getInput('Number')).toHaveValue('T-900'))
    expect(getInput('VIN')).toHaveValue('ZZZ')
  })
})
