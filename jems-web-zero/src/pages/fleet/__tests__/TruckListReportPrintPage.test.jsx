import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TruckListReportPrintPage from '../TruckListReportPrintPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/fleet/makes/') return [{ id: 2, name: 'Volvo' }]
    if (url === '/fleet/cabin-types/') return [{ id: 4, name: 'Volvo 860' }]
    if (url === '/fleet/owners/') return [{ id: 3, full_name: 'Express Fleet LLC' }]
    if (url === '/fleet/loss-payees/') return [{ id: 9, name: 'Continental Bank' }]
    return []
  }),
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { get: vi.fn() } }
})

vi.mock('../../../services/users', () => ({
  usersService: { getDisplayOptions: vi.fn() },
}))

import { trucksService } from '../../../services/trucks'
import { usersService } from '../../../services/users'

beforeEach(() => {
  vi.clearAllMocks()
  usersService.getDisplayOptions.mockResolvedValue({ data: { truck: 'number,VIN,cabintype,make,owner,loss_payee_id' } })
  trucksService.get.mockResolvedValue({
    data: {
      id: 1,
      number: 'T-100',
      vin: 'VIN100',
      cabin_type: 4,
      make: 2,
      is_leased: true,
      owner: 3,
      loss_payee: 9,
      truck_type_name: 'Sleeper',
      status: 1,
    },
  })
})

describe('TruckListReportPrintPage', () => {
  it('renders selected truck fields from display options', async () => {
    render(
      <MemoryRouter initialEntries={['/print/trucks?ids=1']}>
        <TruckListReportPrintPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('Trucks List Report')).toBeInTheDocument()
    expect(await screen.findByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('VIN100')).toBeInTheDocument()
    expect(screen.getByText('Volvo 860')).toBeInTheDocument()
    expect(screen.getByText('Volvo')).toBeInTheDocument()
    expect(screen.getByText('Express Fleet LLC')).toBeInTheDocument()
    expect(screen.getByText('Continental Bank')).toBeInTheDocument()
  })
})
