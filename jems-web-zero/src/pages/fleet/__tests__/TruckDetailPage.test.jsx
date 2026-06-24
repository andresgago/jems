import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TruckDetailPage from '../TruckDetailPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/fleet/makes/') return [{ id: 5, name: 'Freightliner' }]
    if (url === '/carriers/') return [{ id: 3, name: 'Jobee Express' }]
    if (url === '/users/') return [{ id: 8, full_name: 'Dispatch Joe' }]
    return []
  }),
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { get: vi.fn(), toggleStatus: vi.fn() } }
})

import { trucksService } from '../../../services/trucks'

const truck = {
  id: 7, number: 'T-100', vin: '1FUJ', year: 2022, status: 1,
  truck_type_name: 'Sleeper', plate: 'ABC123', make: 5, carrier: 3,
  dispatcher: 8, gross_weight: 35000, is_leased: true, purchase_cost: 120000,
  maintenance_records: [],
}

function renderDetail(id = '7') {
  return render(
    <MemoryRouter initialEntries={[`/fleet/trucks/${id}`]}>
      <Routes>
        <Route path="/fleet/trucks/:id" element={<TruckDetailPage />} />
        <Route path="/fleet/trucks" element={<div>Trucks list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  trucksService.get.mockResolvedValue({ data: truck })
})

describe('TruckDetailPage', () => {
  it('fetches by route id and resolves make, carrier and dispatcher names', async () => {
    renderDetail('7')
    await waitFor(() => expect(trucksService.get).toHaveBeenCalledWith('7'))
    expect(await screen.findByText('Truck T-100')).toBeInTheDocument()
    expect(screen.getByText('Freightliner')).toBeInTheDocument()
    expect(screen.getByText('Jobee Express')).toBeInTheDocument()
    expect(screen.getByText('Dispatch Joe')).toBeInTheDocument()
  })

  it('toggles status', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trucksService.toggleStatus.mockResolvedValue({ data: {} })
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Toggle Status/i }))
    await waitFor(() => expect(trucksService.toggleStatus).toHaveBeenCalledWith(7))
  })

  it('shows not-found on error', async () => {
    trucksService.get.mockRejectedValue(new Error('404'))
    renderDetail()
    expect(await screen.findByText('Truck not found.')).toBeInTheDocument()
  })
})
