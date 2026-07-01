import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DriverListReportPrintPage from '../DriverListReportPrintPage'

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

function renderPage(path = '/print/drivers?ids=1,2') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/print/drivers" element={<DriverListReportPrintPage />} />
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

describe('DriverListReportPrintPage', () => {
  it('renders the selected drivers in legacy report format', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Driver List Report' })).toBeInTheDocument()
    expect(await screen.findByText('Agustin Romero Espinosa')).toBeInTheDocument()
    expect(screen.getByText('Alain Reynier Avila Valles')).toBeInTheDocument()
    expect(screen.getAllByText('First Name')).toHaveLength(2)
    expect(screen.getByText('000045502447')).toBeInTheDocument()
    expect(screen.getAllByText('North Carolina (NC)')).toHaveLength(2)
    expect(driversService.get).toHaveBeenNthCalledWith(1, '1')
    expect(driversService.get).toHaveBeenNthCalledWith(2, '2')
  })

  it('uses report field settings to hide unchecked fields', async () => {
    usersService.getDisplayOptions.mockResolvedValue({ data: { driver: 'name,phone' } })

    renderPage('/print/drivers?ids=1')

    expect(await screen.findByText('Agustin Romero Espinosa')).toBeInTheDocument()
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.queryByText('License number')).not.toBeInTheDocument()
  })

  it('falls back to the legacy default fields when settings are unavailable', async () => {
    usersService.getDisplayOptions.mockRejectedValue(new Error('forbidden'))

    renderPage('/print/drivers?ids=1')

    expect(await screen.findByText('Agustin Romero Espinosa')).toBeInTheDocument()
    expect(screen.getByText('License number')).toBeInTheDocument()
    expect(screen.getByText('License state')).toBeInTheDocument()
  })
})
