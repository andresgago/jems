import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrailerExportPrintPage from '../TrailerExportPrintPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(() => []),
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
  usersService.getDisplayOptions.mockResolvedValue({ data: { trailer: 'number,VIN,status' } })
  trailersService.get.mockResolvedValue({
    data: { id: 1, number: 'TRL-100', vin: 'VIN100', status: 1 },
  })
})

describe('TrailerExportPrintPage', () => {
  it('renders exportable grid columns from display options with the legacy "Showing X-Y of N" header', async () => {
    render(
      <MemoryRouter initialEntries={['/print/trailers/export?ids=1']}>
        <TrailerExportPrintPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('Trailers List Report')).toBeInTheDocument()
    expect(await screen.findByText('Number')).toBeInTheDocument()
    expect(screen.getByText('Vin Number')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('TRL-100')).toBeInTheDocument()
    expect(screen.getByText('VIN100')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Showing 1-1 of 1 items.')).toBeInTheDocument()
  })
})
