import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DriverFormPage from '../DriverFormPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/carriers/') return [{ id: 3, name: 'Jobee Express' }]
    if (url === '/drivers/types/') return [{ id: 1, name: 'Company' }]
    if (url === '/fleet/cards/') return [{ id: 7, number: '589355322232420123' }]
    if (url === '/fleet/owners/') return [{ id: 11, full_name: 'Owner One' }]
    if (url === '/locations/states/') return [{ id: 5, name: 'Texas', abbreviation: 'TX' }]
    if (url === '/drivers/') return [{ id: 22, full_name: 'Team Partner' }]
    return []
  }),
}))

vi.mock('../../../components/PhotoCropper', () => ({
  default: ({ onCrop }) => (
    <button type="button" onClick={() => onCrop(new Blob(['cropped'], { type: 'image/jpeg' }))}>
      Mock Crop Driver Photo
    </button>
  ),
}))

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return {
    ...actual,
    driversService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      uploadPhoto: vi.fn(),
      uploadDocument: vi.fn(),
    },
  }
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
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() => {
      expect(getInput('First Name')).toHaveClass('is-invalid')
    })
    expect(driversService.create).not.toHaveBeenCalled()
  })

  it('serializes FK as id, empty dates as null, numbers and legacy choices as Number', async () => {
    driversService.create.mockResolvedValue({ data: { id: 99 } })
    driversService.uploadPhoto.mockResolvedValue({ data: { id: 99 } })
    driversService.uploadDocument.mockResolvedValue({ data: { id: 1 } })
    renderForm()

    fireEvent.change(getInput('First Name'), { target: { value: 'John' } })
    fireEvent.change(getInput('Last Name'), { target: { value: 'Doe' } })
    fireEvent.change(getInput('Carrier'), { target: { value: '3' } })
    fireEvent.change(getInput('Card fuel'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mock Crop Driver Photo' }))

    fireEvent.click(screen.getByRole('button', { name: 'CDL' }))
    fireEvent.change(getInput('Licence expiration date'), { target: { value: '2026-01-01' } })
    const licenseFile = new File(['license'], 'license.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('License Card'), { target: { files: [licenseFile] } })

    fireEvent.click(screen.getByRole('button', { name: 'Work contract' }))
    fireEvent.change(getInput('Work contract'), { target: { value: '2' } })
    fireEvent.change(getInput('Pay vacation'), { target: { value: '1' } })
    fireEvent.change(getInput('Insurance'), { target: { value: '50' } })
    fireEvent.change(getInput('Owner'), { target: { value: '11' } })

    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(driversService.create).toHaveBeenCalledTimes(1))
    const payload = driversService.create.mock.calls[0][0]
    expect(payload).toMatchObject({
      first_name: 'John',
      last_name: 'Doe',
      license_expiration: '2026-01-01',
      carrier: '3',
      fuel_card: '7',
      owner: '11',
      insurance: 50,
      status: 1,
      contract: 2,
      pay_vacation: 1,
    })
    // empty optional FK / date fields go as null, not ""
    expect(payload.driver_type).toBeNull()
    expect(payload.birth_date).toBeNull()
    await waitFor(() => expect(driversService.uploadDocument).toHaveBeenCalledWith(99, {
      document_type: '1',
      file: licenseFile,
      expiration_date: '2026-01-01',
    }))
    expect(driversService.uploadPhoto).toHaveBeenCalledTimes(1)
    expect(driversService.uploadPhoto.mock.calls[0][1]).toBeInstanceOf(Blob)
  })

  it('shows the legacy Residence and Work contract conditional fields', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Residence' }))
    expect(getInput('Social security number')).toBeInTheDocument()
    expect(screen.getByLabelText('Social security card')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Work contract' }))
    expect(getInput('By Percent')).toBeInTheDocument()
    fireEvent.change(getInput('Work contract'), { target: { value: '1' } })
    expect(getInput('Miles empty')).toBeInTheDocument()
    expect(getInput('Miles full')).toBeInTheDocument()
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
