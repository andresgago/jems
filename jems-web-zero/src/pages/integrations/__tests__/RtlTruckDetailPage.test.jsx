import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RtlTruckDetailPage from '../RtlTruckDetailPage'

vi.mock('../../../services/rtl', async () => {
  const actual = await vi.importActual('../../../services/rtl')
  return {
    ...actual,
    rtlService: { getTruck: vi.fn() },
  }
})

import { rtlService } from '../../../services/rtl'

const truck = {
  id: 1,
  rtl_id: 'rtl-trk-001',
  company_id: 'comp-1',
  name: 'T-100',
  vin: '1HTMKAAR3BH001001',
  year: '2022',
  make: 'International',
  model: 'LT',
  plate_number: 'ABC123',
  eld_serial_number: 'ELD123456',
  active: true,
  synced_at: '2024-01-01T00:00:00Z',
  latest_status: {
    speed: 65.2,
    odometer: 123456,
    lat: 29.76,
    lon: -95.36,
    calculated_location: 'Houston, TX',
    timestamp: '2024-01-01T12:00:00Z',
    vin: '1HTMKAAR3BH001001',
    synced_at: '2024-01-01T12:00:00Z',
  },
}

function renderWithRoute(id = '1') {
  return render(
    <MemoryRouter initialEntries={[`/rtl/trucks/${id}`]}>
      <Routes>
        <Route path="/rtl/trucks/:id" element={<RtlTruckDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RtlTruckDetailPage', () => {
  it('renders truck name and VIN', async () => {
    rtlService.getTruck.mockResolvedValue({ data: truck })
    renderWithRoute()
    // T-100 appears in the heading and the Name field; findAllByText handles multiples
    const nameEls = await screen.findAllByText('T-100')
    expect(nameEls.length).toBeGreaterThanOrEqual(1)
    // VIN appears in Truck Info and GPS status; verify at least one is present
    const vinEls = screen.getAllByText('1HTMKAAR3BH001001')
    expect(vinEls.length).toBeGreaterThanOrEqual(1)
  })

  it('renders speed from GPS status', async () => {
    rtlService.getTruck.mockResolvedValue({ data: truck })
    renderWithRoute()
    expect(await screen.findByText('65 mph')).toBeInTheDocument()
  })

  it('renders calculated location', async () => {
    rtlService.getTruck.mockResolvedValue({ data: truck })
    renderWithRoute()
    expect(await screen.findByText('Houston, TX')).toBeInTheDocument()
  })

  it('renders RTL ID in sync info', async () => {
    rtlService.getTruck.mockResolvedValue({ data: truck })
    renderWithRoute()
    expect(await screen.findByText('rtl-trk-001')).toBeInTheDocument()
  })

  it('shows not found alert on error', async () => {
    rtlService.getTruck.mockRejectedValue(new Error('404'))
    renderWithRoute()
    expect(await screen.findByText('RTL truck not found.')).toBeInTheDocument()
  })

  it('shows no GPS status message when latest_status is null', async () => {
    rtlService.getTruck.mockResolvedValue({ data: { ...truck, latest_status: null } })
    renderWithRoute()
    expect(await screen.findByText('No GPS status available.')).toBeInTheDocument()
  })
})
