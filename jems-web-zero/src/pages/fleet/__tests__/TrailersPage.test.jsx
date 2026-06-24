import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrailersPage from '../TrailersPage'

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { list: vi.fn(), toggleStatus: vi.fn() } }
})

import { trailersService } from '../../../services/trailers'

const trailers = [
  { id: 1, number: 'TRL-100', trailer_type_name: '53ft Dry Van', vin: 'VIN001', year: 2021, status: 1, plate_number: 'TX-001', annual_inspection_expiration: '2020-01-01', is_rented: false },
  { id: 2, number: 'TRL-200', trailer_type_name: 'Reefer', vin: 'VIN002', year: 2022, status: 1, plate_number: 'TX-002', annual_inspection_expiration: '2030-01-01', is_rented: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  trailersService.list.mockResolvedValue({ data: trailers })
})

describe('TrailersPage', () => {
  it('lists trailers returned by the service', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    expect(await screen.findByText('TRL-100')).toBeInTheDocument()
    expect(screen.getByText('TRL-200')).toBeInTheDocument()
  })

  it('filters by number or VIN (client-side)', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')
    fireEvent.change(screen.getByPlaceholderText('Number or VIN…'), { target: { value: 'trl-200' } })
    expect(screen.queryByText('TRL-100')).not.toBeInTheDocument()
    expect(screen.getByText('TRL-200')).toBeInTheDocument()
  })

  it('shows Rented badge for rented trailers', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-200')
    expect(screen.getByText('Rented')).toBeInTheDocument()
  })

  it('highlights expired AI expiration date in red', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('2020-01-01')
    const expired = screen.getByText('2020-01-01')
    expect(expired.className).toContain('text-danger')
  })

  it('toggles status and refreshes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailersService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(trailersService.toggleStatus).toHaveBeenCalledWith(1))
  })
})
