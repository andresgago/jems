import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RtlDriverDetailPage from '../RtlDriverDetailPage'

vi.mock('../../../services/rtl', async () => {
  const actual = await vi.importActual('../../../services/rtl')
  return {
    ...actual,
    rtlService: { getDriver: vi.fn() },
  }
})

import { rtlService } from '../../../services/rtl'

const driver = {
  id: 1,
  rtl_id: 'rtl-drv-001',
  company_id: 'comp-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone_num: '555-0001',
  license_number: 'D001',
  license_state: 'TX',
  active: true,
  synced_at: '2024-01-01T00:00:00Z',
  latest_status: {
    hos_event_code: 'DS_D',
    hos_event_time: '2024-01-01T10:00:00Z',
    location_state: 'TX',
    location_lat: 29.76,
    location_lon: -95.36,
    vehicle_vin: '1FUJ000000000001X',
    daily_hours_driven: 5.0,
    daily_hours_on_duty: 6.0,
    eta: '',
    synced_at: '2024-01-01T00:00:00Z',
  },
}

function renderWithRoute(id = '1') {
  return render(
    <MemoryRouter initialEntries={[`/rtl/drivers/${id}`]}>
      <Routes>
        <Route path="/rtl/drivers/:id" element={<RtlDriverDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RtlDriverDetailPage', () => {
  it('renders driver name and email', async () => {
    rtlService.getDriver.mockResolvedValue({ data: driver })
    renderWithRoute()
    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('renders HOS status badge', async () => {
    rtlService.getDriver.mockResolvedValue({ data: driver })
    renderWithRoute()
    expect(await screen.findByText('Driving')).toBeInTheDocument()
  })

  it('renders daily hours driven', async () => {
    rtlService.getDriver.mockResolvedValue({ data: driver })
    renderWithRoute()
    expect(await screen.findByText('5.0 h')).toBeInTheDocument()
  })

  it('renders RTL ID in sync info', async () => {
    rtlService.getDriver.mockResolvedValue({ data: driver })
    renderWithRoute()
    expect(await screen.findByText('rtl-drv-001')).toBeInTheDocument()
  })

  it('shows not found alert on error', async () => {
    rtlService.getDriver.mockRejectedValue(new Error('404'))
    renderWithRoute()
    expect(await screen.findByText('RTL driver not found.')).toBeInTheDocument()
  })

  it('shows no status message when latest_status is null', async () => {
    rtlService.getDriver.mockResolvedValue({ data: { ...driver, latest_status: null } })
    renderWithRoute()
    expect(await screen.findByText('No HOS status available.')).toBeInTheDocument()
  })
})
