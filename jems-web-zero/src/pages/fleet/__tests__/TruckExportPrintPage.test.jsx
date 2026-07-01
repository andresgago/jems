import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TruckExportPrintPage from '../TruckExportPrintPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(() => []),
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
  usersService.getDisplayOptions.mockResolvedValue({ data: { truck: 'number,VIN,status' } })
  trucksService.get.mockResolvedValue({
    data: { id: 1, number: 'T-100', vin: 'VIN100', status: 1 },
  })
})

describe('TruckExportPrintPage', () => {
  it('renders exportable grid columns from display options', async () => {
    render(
      <MemoryRouter initialEntries={['/print/trucks/export?ids=1']}>
        <TruckExportPrintPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('Trucks List Report')).toBeInTheDocument()
    expect(await screen.findByText('Number')).toBeInTheDocument()
    expect(screen.getByText('Vin number')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('VIN100')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
