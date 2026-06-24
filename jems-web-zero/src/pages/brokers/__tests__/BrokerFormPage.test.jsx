import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BrokerFormPage from '../BrokerFormPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/carriers/') return [{ id: 1, name: 'Jobee Express LLC' }]
    if (url === '/locations/states/') return [{ id: 9, name: 'Texas' }]
    return []
  }),
}))

vi.mock('../../../services/brokers', async () => {
  const actual = await vi.importActual('../../../services/brokers')
  return { ...actual, brokersService: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }
})

import { brokersService } from '../../../services/brokers'

function getInput(labelText) {
  return screen.getByText(labelText, { selector: 'label' }).parentElement.querySelector('input, select, textarea')
}

function renderForm(path = '/brokers/create') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/brokers/create" element={<BrokerFormPage />} />
        <Route path="/brokers/:id/edit" element={<BrokerFormPage />} />
        <Route path="/brokers/:id" element={<div>Broker detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('BrokerFormPage (create)', () => {
  it('requires MC before submitting', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Create Broker/i }))
    await waitFor(() => expect(getInput('MC')).toHaveClass('is-invalid'))
    expect(brokersService.create).not.toHaveBeenCalled()
  })

  it('requires Name before submitting', async () => {
    renderForm()
    fireEvent.change(getInput('MC'), { target: { value: 'MC001' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Broker/i }))
    await waitFor(() => expect(getInput('Legal Name')).toHaveClass('is-invalid'))
    expect(brokersService.create).not.toHaveBeenCalled()
  })

  it('serializes empty date and email fields as null', async () => {
    brokersService.create.mockResolvedValue({ data: { id: 5 } })
    renderForm()
    fireEvent.change(getInput('MC'), { target: { value: 'NEWMC001' } })
    fireEvent.change(getInput('Legal Name'), { target: { value: 'Test Broker LLC' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Broker/i }))
    await waitFor(() => expect(brokersService.create).toHaveBeenCalled())
    const payload = brokersService.create.mock.calls[0][0]
    expect(payload.mc).toBe('NEWMC001')
    expect(payload.name).toBe('Test Broker LLC')
    expect(payload.checked_at).toBeNull()
    expect(payload.email).toBeNull()
    expect(payload.status).toBe(1)
  })

  it('renders Carrier select with seeded option', () => {
    renderForm()
    expect(screen.getByRole('option', { name: 'Jobee Express LLC' })).toBeInTheDocument()
  })

  it('renders State select with seeded option', () => {
    renderForm()
    expect(screen.getByRole('option', { name: 'Texas' })).toBeInTheDocument()
  })

  it('submit button reads "Create Broker"', () => {
    renderForm()
    expect(screen.getByRole('button', { name: /Create Broker/i })).toBeInTheDocument()
  })
})

describe('BrokerFormPage (edit)', () => {
  it('pre-populates form and sends PATCH on save', async () => {
    brokersService.get.mockResolvedValue({
      data: {
        id: 3, mc: 'MC003', name: 'Old Name LLC', dba_name: 'Old', email: null,
        phone: '', accounting_email: null, status: 1,
        factor_company: '', factor_account_id: '', buy_status: '', debtor_buy_status: '',
        details: '', checked_at: null,
        physical_address: '', mailing_address: '', city: null, state: null, zip: '',
        usdot_number: '', safer_operating_status: '', carrier: null,
      },
    })
    brokersService.update.mockResolvedValue({ data: { id: 3 } })

    renderForm('/brokers/3/edit')
    await waitFor(() => expect(screen.getByDisplayValue('MC003')).toBeInTheDocument())
    expect(getInput('MC')).toHaveValue('MC003')

    fireEvent.change(getInput('Legal Name'), { target: { value: 'New Name LLC' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

    await waitFor(() =>
      expect(brokersService.update).toHaveBeenCalledWith(
        '3',
        expect.objectContaining({ name: 'New Name LLC' })
      )
    )
  })
})
