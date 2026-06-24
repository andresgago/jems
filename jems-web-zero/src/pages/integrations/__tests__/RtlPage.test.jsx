import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RtlPage from '../RtlPage'

vi.mock('../../../services/rtl', async () => {
  const actual = await vi.importActual('../../../services/rtl')
  return {
    ...actual,
    rtlService: {
      listDrivers: vi.fn(),
      listTrucks: vi.fn(),
    },
  }
})

import { rtlService } from '../../../services/rtl'

const drivers = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    license_number: 'D001',
    license_state: 'TX',
    phone_num: '555-0001',
    active: true,
    latest_status: {
      hos_event_code: 'DS_D',
      location_state: 'TX',
      location_lat: 29.76,
      location_lon: -95.36,
      vehicle_vin: '1FUJ000000000001X',
      daily_hours_driven: 5.0,
      daily_hours_on_duty: 6.0,
      eta: '',
      synced_at: '2024-01-01T00:00:00Z',
    },
  },
  {
    id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    license_number: 'D002',
    license_state: 'FL',
    phone_num: '555-0002',
    active: false,
    latest_status: null,
  },
]

const trucks = [
  {
    id: 1,
    name: 'T-100',
    vin: '1HTMKAAR3BH001001',
    year: '2022',
    make: 'International',
    model: 'LT',
    plate_number: 'ABC123',
    active: true,
    latest_status: { speed: 65.2, odometer: 123456, lat: 29.76, lon: -95.36, calculated_location: 'Houston, TX', timestamp: '2024-01-01T12:00:00Z', vin: '1HTMKAAR3BH001001', synced_at: '2024-01-01T12:00:00Z' },
  },
  {
    id: 2,
    name: 'T-200',
    vin: '1HTMKAAR3BH002002',
    year: '2021',
    make: 'Freightliner',
    model: 'Cascadia',
    plate_number: 'XYZ789',
    active: false,
    latest_status: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  rtlService.listDrivers.mockResolvedValue({ data: drivers })
  rtlService.listTrucks.mockResolvedValue({ data: trucks })
})

describe('RtlPage — Drivers tab', () => {
  it('shows drivers tab by default', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows HOS badge for drivers with status', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    expect(await screen.findByText('Driving')).toBeInTheDocument()
  })

  it('shows Active badge for active drivers', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    const badges = screen.getAllByText('Active')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('filters drivers by name (client-side)', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.change(screen.getByPlaceholderText('Name or license…'), { target: { value: 'jane' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('filters drivers by active status', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'false' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })
})

describe('RtlPage — Trucks tab', () => {
  it('switches to trucks tab', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByRole('button', { name: /trucks/i }))
    expect(await screen.findByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })

  it('shows speed from GPS status', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByRole('button', { name: /trucks/i }))
    expect(await screen.findByText('65 mph')).toBeInTheDocument()
  })

  it('filters trucks by name (client-side)', async () => {
    render(<MemoryRouter><RtlPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByRole('button', { name: /trucks/i }))
    await screen.findByText('T-100')
    fireEvent.change(screen.getByPlaceholderText('Name or VIN…'), { target: { value: 'T-200' } })
    expect(screen.queryByText('T-100')).not.toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })
})
