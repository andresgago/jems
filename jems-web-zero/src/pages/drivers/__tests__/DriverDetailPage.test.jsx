import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DriverDetailPage from '../DriverDetailPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/carriers/') return [{ id: 3, name: 'Jobee Express' }]
    if (url === '/locations/states/') return [{ id: 9, name: 'Texas', abbreviation: 'TX' }]
    return []
  }),
}))

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return { ...actual, driversService: { get: vi.fn(), toggleStatus: vi.fn() } }
})

import { driversService } from '../../../services/drivers'

const driver = {
  id: 7, first_name: 'John', last_name: 'Doe', full_name: 'John Doe',
  driver_type_name: 'Company', status: 1, phone: '555', email: 'j@x.com',
  address: '1 St', carrier: 3, license_state: 9, license_number: 'D123',
  contract: 2, contract_display: 'By percent no expenses',
  pay_vacation: 0, pay_vacation_display: 'Yes',
  on_vacation: false, insurance: 50, percent: 25, weekly_rate: 0,
  documents: [],
}

function renderDetail(id = '7') {
  return render(
    <MemoryRouter initialEntries={[`/drivers/${id}`]}>
      <Routes>
        <Route path="/drivers/:id" element={<DriverDetailPage />} />
        <Route path="/drivers" element={<div>Drivers list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  driversService.get.mockResolvedValue({ data: driver })
})

describe('DriverDetailPage', () => {
  it('fetches by route id and resolves carrier and state names', async () => {
    renderDetail('7')
    await waitFor(() => expect(driversService.get).toHaveBeenCalledWith('7'))
    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jobee Express')).toBeInTheDocument()
    expect(screen.getByText('Texas (TX)')).toBeInTheDocument()
    expect(screen.getByText('By percent no expenses')).toBeInTheDocument()
  })

  it('toggles status', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driversService.toggleStatus.mockResolvedValue({ data: {} })
    renderDetail()
    const btn = await screen.findByRole('button', { name: /Toggle Status/i })
    fireEvent.click(btn)
    await waitFor(() => expect(driversService.toggleStatus).toHaveBeenCalledWith(7))
  })

  it('shows not-found on error', async () => {
    driversService.get.mockRejectedValue(new Error('404'))
    renderDetail()
    expect(await screen.findByText('Driver not found.')).toBeInTheDocument()
  })
})
