import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrailerListReportPrintPage from '../TrailerListReportPrintPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((url) => {
    if (url === '/fleet/trailer-types/') return [{ id: 4, name: 'Reefer' }]
    if (url === '/fleet/owners/') return [{ id: 3, full_name: 'Express Fleet LLC' }]
    if (url === '/carriers/') return [{ id: 6, name: 'Jobee Express' }]
    if (url === '/locations/states/') return [{ id: 9, name: 'Texas' }]
    return []
  }),
}))

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { get: vi.fn() } }
})

vi.mock('../../../services/users', () => ({
  usersService: { getDisplayOptions: vi.fn() },
}))

import { trailersService } from '../../../services/trailers'
import { usersService } from '../../../services/users'

beforeEach(() => {
  vi.clearAllMocks()
  usersService.getDisplayOptions.mockResolvedValue({ data: { trailer: 'number,VIN,year,losspayee' } })
  trailersService.get.mockResolvedValue({
    data: {
      id: 1,
      number: 'TRL-100',
      vin: 'VIN100',
      year: 2022,
      loss_payee: 'Express Fleet LLC',
      trailer_type_name: 'Reefer',
      status: 1,
    },
  })
})

describe('TrailerListReportPrintPage', () => {
  it('renders selected trailer fields from display options', async () => {
    render(
      <MemoryRouter initialEntries={['/print/trailers?ids=1']}>
        <TrailerListReportPrintPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('Trailers List Report')).toBeInTheDocument()
    expect(await screen.findByText('TRL-100 - VIN100')).toBeInTheDocument()
    expect(screen.getByText('VIN100')).toBeInTheDocument()
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(screen.getByText('Express Fleet LLC')).toBeInTheDocument()
  })
})
