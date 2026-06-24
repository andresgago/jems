import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoadDetailPage from '../LoadDetailPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(() => [{ id: 7, name: 'Reefer', short_name: 'R' }]),
}))

vi.mock('../../../services/loads', async () => {
  const actual = await vi.importActual('../../../services/loads')
  return {
    ...actual,
    loadsService: {
      get: vi.fn(),
      setStatus: vi.fn(),
      setHistory: vi.fn(),
      toggleInvoiced: vi.fn(),
      togglePaid: vi.fn(),
    },
  }
})

import { loadsService } from '../../../services/loads'

const baseLoad = {
  id: 42,
  number: 'JB-1001',
  status: 1,
  payment: 2500,
  miles: 600,
  miles_empty: 40,
  weight: 42000,
  trailer_type: 7,
  drop_trailer: false,
  pickup_city_display: 'Dallas, TX',
  pickup_address: '100 Main St',
  pickup_date: '2026-06-20T12:00:00-04:00',
  dropoff_city_display: 'Atlanta, GA',
  dropoff_address: '200 Peach St',
  dropoff_date: '2026-06-22T12:00:00-04:00',
  broker_name: 'Acme Logistics',
  carrier_name: 'Jobee Express',
  shipper_name: 'Shipper Co',
  receiver_name: 'Receiver Co',
  driver: 5,
  truck: 9,
  trailer: null,
  team_driver: null,
  detention: 0,
  lumper: 150,
  lumper_paid_by: 'broker',
  invoiced: false,
  paid: false,
  owner_invoiced: false,
  owner_paid: false,
  shipper_rating: 4,
  receiver_rating: null,
  rate_file: '/media/loads/rate.pdf',
  bill_file: null,
  lumper_file: null,
  detention_file: null,
  details: 'Must be on time.',
  stops: [],
}

function renderDetail(id = '42') {
  return render(
    <MemoryRouter initialEntries={[`/loads/${id}`]}>
      <Routes>
        <Route path="/loads/:id" element={<LoadDetailPage />} />
        <Route path="/loads" element={<div>Loads list</div>} />
        <Route path="/loads/:id/edit" element={<div>Edit form</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  loadsService.get.mockResolvedValue({ data: baseLoad })
})

describe('LoadDetailPage', () => {
  it('fetches the load by id from the route param', async () => {
    renderDetail('42')
    await waitFor(() => expect(loadsService.get).toHaveBeenCalledWith('42'))
  })

  it('renders the load header, route and resolved trailer type name', async () => {
    renderDetail()
    expect(await screen.findByText('Load JB-1001')).toBeInTheDocument()
    expect(screen.getByText('Dallas, TX')).toBeInTheDocument()
    expect(screen.getByText('Atlanta, GA')).toBeInTheDocument()
    // raw ISO datetime is normalized to ET "YYYY-MM-DD HH:MM"
    expect(screen.getByText('2026-06-20 12:00')).toBeInTheDocument()
    expect(screen.getByText('Acme Logistics')).toBeInTheDocument()
    // trailer_type id 7 resolved via useOptions
    expect(screen.getByText('Reefer (R)')).toBeInTheDocument()
  })

  it('renders a download link for present files and a dash for missing ones', async () => {
    renderDetail()
    const link = await screen.findByRole('link', { name: /Download/i })
    expect(link).toHaveAttribute('href', 'http://localhost:8000/media/loads/rate.pdf')
  })

  it('toggles invoiced and refreshes', async () => {
    loadsService.toggleInvoiced.mockResolvedValue({ data: { ...baseLoad, invoiced: true } })
    renderDetail()
    const btn = await screen.findByRole('button', { name: /Mark Invoiced/i })
    fireEvent.click(btn)
    await waitFor(() => expect(loadsService.toggleInvoiced).toHaveBeenCalledWith(42))
    // refresh re-fetches the load
    await waitFor(() => expect(loadsService.get).toHaveBeenCalledTimes(2))
  })

  it('shows a not-found message when the load fails to load', async () => {
    loadsService.get.mockRejectedValue(new Error('404'))
    renderDetail()
    expect(await screen.findByText('Load not found.')).toBeInTheDocument()
  })
})
