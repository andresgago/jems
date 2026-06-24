import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecordFormPage from '../RecordFormPage'

vi.mock('../../../services/accounting', async () => {
  const actual = await vi.importActual('../../../services/accounting')
  return {
    ...actual,
    recordsService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
})

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: (url) => {
    if (url.includes('accounts')) return [{ id: 1, code: '90010', name: 'Rate' }, { id: 2, code: '80030', name: 'Fuel' }]
    if (url.includes('categories')) return [{ id: 1, name: 'Maintenance' }]
    return []
  },
}))

import { recordsService } from '../../../services/accounting'

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/accounting/records/create']}>
      <Routes>
        <Route path="/accounting/records/create" element={<RecordFormPage />} />
        <Route path="/accounting/records/:id" element={<div>Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id) {
  return render(
    <MemoryRouter initialEntries={[`/accounting/records/${id}/edit`]}>
      <Routes>
        <Route path="/accounting/records/:id/edit" element={<RecordFormPage />} />
        <Route path="/accounting/records/:id" element={<div>Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RecordFormPage — create', () => {
  it('renders "New Record" heading', () => {
    renderCreate()
    expect(screen.getByText('New Record')).toBeInTheDocument()
  })

  it('has date, account, amount required fields', () => {
    renderCreate()
    expect(screen.getByRole('button', { name: 'Create Record' })).toBeInTheDocument()
  })

  it('renders account options from useOptions', () => {
    renderCreate()
    expect(screen.getByText('90010 – Rate')).toBeInTheDocument()
    expect(screen.getByText('80030 – Fuel')).toBeInTheDocument()
  })

  it('shows validation errors when required fields empty', async () => {
    renderCreate()
    // account='' and amount='' by default — just submit immediately
    fireEvent.click(screen.getByText('Create Record'))
    expect(await screen.findByText('Account is required.')).toBeInTheDocument()
    expect(screen.getByText('Amount is required.')).toBeInTheDocument()
  })

  it('calls create with null for empty FK fields', async () => {
    recordsService.create.mockResolvedValue({ data: { id: 99 } })
    renderCreate()

    // Fill amount
    const amountLabel = screen.getByText(/^Amount/, { selector: 'label' })
    const amountInput = amountLabel.closest('div').querySelector('input')
    fireEvent.change(amountInput, { target: { value: '500' } })

    // Select an account
    const accountLabel = screen.getByText(/^Account/, { selector: 'label' })
    const accountSelect = accountLabel.closest('div').querySelector('select')
    fireEvent.change(accountSelect, { target: { value: '1' } })

    fireEvent.click(screen.getByText('Create Record'))

    await waitFor(() => {
      const payload = recordsService.create.mock.calls[0][0]
      expect(payload.load).toBeNull()
      expect(payload.truck).toBeNull()
      expect(payload.driver).toBeNull()
    })
  })

  it('calls create with Number() for amount', async () => {
    recordsService.create.mockResolvedValue({ data: { id: 42 } })
    renderCreate()

    // Select an account
    const accountLabel = screen.getByText(/^Account/, { selector: 'label' })
    const accountSelect = accountLabel.closest('div').querySelector('select')
    fireEvent.change(accountSelect, { target: { value: '1' } })

    // Fill amount
    const amountLabel = screen.getByText(/^Amount/, { selector: 'label' })
    const amountInput = amountLabel.closest('div').querySelector('input')
    fireEvent.change(amountInput, { target: { value: '1500.50' } })

    fireEvent.click(screen.getByText('Create Record'))

    await waitFor(() => {
      const payload = recordsService.create.mock.calls[0][0]
      expect(typeof payload.amount).toBe('number')
    })
  })
})

describe('RecordFormPage — edit', () => {
  it('renders "Edit Record" heading and pre-populates from service', async () => {
    recordsService.get.mockResolvedValue({
      data: {
        id: 5,
        date: '2026-05-15',
        account: 1,
        quantity: 1.0,
        amount: 750.0,
        detail: 'Existing detail',
        record_type: 2,
        load: null, truck: null, trailer: null, driver: null,
        team_driver: null, owner: null, category: null,
        category_expire: false, category_expire_date: null,
        dispatcher: null, city: null, card: null, carrier: null,
        product: '', transaction_number: '',
      },
    })
    renderEdit(5)
    expect(await screen.findByText('Edit Record')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Existing detail')).toBeInTheDocument()
  })

  it('calls update (PATCH) on submit', async () => {
    recordsService.get.mockResolvedValue({
      data: {
        id: 5, date: '2026-05-15', account: 1, quantity: 1, amount: 750,
        detail: 'Old detail', record_type: 2,
        load: null, truck: null, trailer: null, driver: null,
        team_driver: null, owner: null, category: null,
        category_expire: false, category_expire_date: null,
        dispatcher: null, city: null, card: null, carrier: null,
        product: '', transaction_number: '',
      },
    })
    recordsService.update.mockResolvedValue({ data: { id: 5 } })

    renderEdit(5)
    await screen.findByText('Edit Record')

    fireEvent.click(screen.getByText('Save Changes'))
    await waitFor(() => expect(recordsService.update).toHaveBeenCalledWith('5', expect.any(Object)))
  })
})
