import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrailersInDropPrintPage from '../TrailersInDropPrintPage'

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { getDropStatuses: vi.fn() } }
})

import { trailersService } from '../../../services/trailers'

beforeEach(() => vi.clearAllMocks())

describe('TrailersInDropPrintPage', () => {
  it('renders the legacy "Trailers in Drop Report" title and rows', async () => {
    trailersService.getDropStatuses.mockResolvedValue({
      data: [
        {
          trailer_id: 1,
          trailer_number: 'TRL-100',
          trailer_vin: 'VIN100',
          drop_label: 'Drop in Pick Up',
          load_number: 'LD-001',
          load_status: 'Started',
          pickup_date: '2024-06-01T00:00:00Z',
          dropoff_date: '2024-06-05T00:00:00Z',
          drop_place: 'In pick up',
          dispatcher: 'Jane Doe',
          driver: 'John Smith',
          truck_number: 'T-1',
          truck_vin: 'TVIN1',
        },
      ],
    })
    render(<TrailersInDropPrintPage />)
    expect(await screen.findByText('Trailers in Drop Report')).toBeInTheDocument()
    expect(await screen.findByText('TRL-100 - VIN100')).toBeInTheDocument()
    expect(screen.getByText('Drop in Pick Up')).toBeInTheDocument()
    expect(screen.getByText('LD-001')).toBeInTheDocument()
  })

  it('shows an empty state when no trailers are in drop', async () => {
    trailersService.getDropStatuses.mockResolvedValue({ data: [] })
    render(<TrailersInDropPrintPage />)
    expect(await screen.findByText('No trailers currently in drop.')).toBeInTheDocument()
  })
})
