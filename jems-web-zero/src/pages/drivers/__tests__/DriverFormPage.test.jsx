import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DriverFormPage from '../DriverFormPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/carriers/') return [{ id: 3, name: 'Jobee Express' }]
    if (url === '/drivers/types/') return [{ id: 1, name: 'Company' }]
    return []
  }),
}))

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return { ...actual, driversService: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }
})

import { driversService } from '../../../services/drivers'

function getInput(labelText) {
  return screen.getByText(labelText, { selector: 'label' }).parentElement.querySelector('input, select, textarea')
}

function renderForm(path = '/drivers/create') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/drivers/create" element={<DriverFormPage />} />
        <Route path="/drivers/:id/edit" element={<DriverFormPage />} />
        <Route path="/drivers/:id" element={<div>Driver detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('DriverFormPage (create)', () => {
  it('requires first and last name before submitting', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Create Driver/i }))
    await waitFor(() => {
      expect(getInput('First Name')).toHaveClass('is-invalid')
    })
    expect(driversService.create).not.toHaveBeenCalled()
  })

  it('serializes FK as id, empty dates as null, numbers as Number, status as Number', async () => {
    driversService.create.mockResolvedValue({ data: { id: 99 } })
    renderForm()

    fireEvent.change(getInput('First Name'), { target: { value: 'John' } })
    fireEvent.change(getInput('Last Name'), { target: { value: 'Doe' } })
    fireEvent.change(getInput('License Expiration'), { target: { value: '2026-01-01' } })
    fireEvent.change(getInput('Carrier'), { target: { value: '3' } })
    fireEvent.change(getInput('Insurance'), { target: { value: '50' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Driver/i }))

    await waitFor(() => expect(driversService.create).toHaveBeenCalledTimes(1))
    const payload = driversService.create.mock.calls[0][0]
    expect(payload).toMatchObject({
      first_name: 'John',
      last_name: 'Doe',
      license_expiration: '2026-01-01',
      carrier: '3',
      insurance: 50,
      status: 1,
    })
    // empty optional FK / date fields go as null, not ""
    expect(payload.driver_type).toBeNull()
    expect(payload.birth_date).toBeNull()
  })
})

describe('DriverFormPage (edit)', () => {
  it('prefills the form from the fetched driver', async () => {
    driversService.get.mockResolvedValue({
      data: { id: 5, first_name: 'Ann', last_name: 'Lee', status: 0, carrier: 3, birth_date: null },
    })
    renderForm('/drivers/5/edit')
    await waitFor(() => expect(getInput('First Name')).toHaveValue('Ann'))
    expect(getInput('Last Name')).toHaveValue('Lee')
  })
})
