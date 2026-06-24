import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrucksPage from '../TrucksPage'

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn(), toggleStatus: vi.fn() } }
})

import { trucksService } from '../../../services/trucks'

const trucks = [
  { id: 1, number: 'T-100', truck_type_name: 'Sleeper', plate: 'ABC123', vin: '1FUJ', year: 2022, status: 1, avi_expiration: '2020-01-01', registration_expiration: '2030-01-01' },
  { id: 2, number: 'T-200', truck_type_name: 'Day Cab', plate: 'XYZ789', vin: '2GHK', year: 2023, status: 1, avi_expiration: '2030-01-01', registration_expiration: '2030-01-01' },
]

beforeEach(() => {
  vi.clearAllMocks()
  trucksService.list.mockResolvedValue({ data: trucks })
})

describe('TrucksPage', () => {
  it('lists trucks returned by the service', async () => {
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    expect(await screen.findByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })

  it('filters by number or VIN (client-side)', async () => {
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')
    fireEvent.change(screen.getByPlaceholderText('Number or VIN…'), { target: { value: 't-200' } })
    expect(screen.queryByText('T-100')).not.toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })

  it('toggles status and refreshes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trucksService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(trucksService.toggleStatus).toHaveBeenCalledWith(1))
  })
})
