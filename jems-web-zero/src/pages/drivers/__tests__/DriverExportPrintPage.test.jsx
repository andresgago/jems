import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DriverExportPrintPage from '../DriverExportPrintPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(),
}))

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return {
    ...actual,
    driversService: { get: vi.fn() },
  }
})

vi.mock('../../../services/users', () => ({
  usersService: { getDisplayOptions: vi.fn() },
}))

import { useOptions } from '../../../hooks/useOptions'
import { driversService } from '../../../services/drivers'
import { usersService } from '../../../services/users'

const drivers = {
  1: {
    id: 1,
    first_name: 'Agustin',
    last_name: 'Romero Espinosa',
    full_name: 'Agustin Romero Espinosa',
    phone: '(704) 496-0347',
    birth_date: '1985-07-25',
    license_number: '000045502447',
    license_state: 37,
    status: 1,
  },
  2: {
    id: 2,
    first_name: 'Alain Reynier',
    last_name: 'Avila Valles',
    full_name: 'Alain Reynier Avila Valles',
    phone: '(704) 777-7290',
    birth_date: '1983-12-02',
    license_number: '000046625330',
    license_state: 37,
    status: 1,
  },
}

function renderPage(path = '/print/drivers/export?ids=1,2') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/print/drivers/export" element={<DriverExportPrintPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useOptions.mockReturnValue([{ id: 37, name: 'North Carolina', abbreviation: 'NC' }])
  usersService.getDisplayOptions.mockResolvedValue({
    data: { driver: 'name,lastname,phone,birth,licensenumber,licensestate' },
  })
  driversService.get.mockImplementation((id) => Promise.resolve({ data: drivers[id] }))
})

describe('DriverExportPrintPage', () => {
  it('renders selected drivers as the legacy export grid', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Driver List Report' })).toBeInTheDocument()
    expect(await screen.findByText('Agustin')).toBeInTheDocument()
    expect(screen.getByText('Alain Reynier')).toBeInTheDocument()
    expect(screen.getByText('Showing 1-2 of 2 items.')).toBeInTheDocument()
    expect(screen.getByText('License number')).toBeInTheDocument()
    expect(screen.getAllByText('North Carolina (NC)')).toHaveLength(2)
    expect(screen.getByPlaceholderText('Find by First Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Find by Licence')).toBeInTheDocument()
  })

  it('uses field settings to control export grid columns', async () => {
    usersService.getDisplayOptions.mockResolvedValue({ data: { driver: 'name,phone' } })

    renderPage('/print/drivers/export?ids=1')

    expect(await screen.findByText('Agustin')).toBeInTheDocument()
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.queryByText('License number')).not.toBeInTheDocument()
  })
})
