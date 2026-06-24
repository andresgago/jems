import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IftaPage from '../IftaPage'

vi.mock('../../../services/rtl', async () => {
  const actual = await vi.importActual('../../../services/rtl')
  return {
    ...actual,
    rtlService: { listIfta: vi.fn() },
  }
})

import { rtlService } from '../../../services/rtl'

const reports = [
  {
    id: 1,
    vehicle_name: 'T-100',
    vehicle_vin: '1HTMKAAR3BH001001',
    from_date: '2024-01-01',
    to_date: '2024-03-31',
    status_id: 'READY',
    time_generated: '2024-04-01T00:00:00Z',
    url: 'https://example.com/report1.pdf',
    csv_url: 'https://example.com/report1.csv',
  },
  {
    id: 2,
    vehicle_name: 'T-200',
    vehicle_vin: '1HTMKAAR3BH002002',
    from_date: '2024-01-01',
    to_date: '2024-03-31',
    status_id: 'PROCESSING',
    time_generated: '',
    url: '',
    csv_url: '',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  rtlService.listIfta.mockResolvedValue({ data: reports })
})

describe('IftaPage', () => {
  it('renders IFTA reports', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    expect(await screen.findByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })

  it('shows READY status badge for ready reports', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    expect(await screen.findByText('READY')).toBeInTheDocument()
  })

  it('shows PROCESSING status badge for processing reports', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    expect(await screen.findByText('PROCESSING')).toBeInTheDocument()
  })

  it('renders PDF and CSV download links for ready reports', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    await screen.findByText('T-100')
    expect(screen.getByTitle('Download PDF')).toBeInTheDocument()
    expect(screen.getByTitle('Download CSV')).toBeInTheDocument()
  })

  it('filters by vehicle name search', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    await screen.findByText('T-100')
    fireEvent.change(screen.getByPlaceholderText('Truck name or VIN…'), { target: { value: 'T-200' } })
    expect(screen.queryByText('T-100')).not.toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
  })

  it('filters by VIN dropdown', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    await screen.findByText('T-100')
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '1HTMKAAR3BH001001' } })
    expect(screen.queryByText('T-200')).not.toBeInTheDocument()
    expect(screen.getByText('T-100')).toBeInTheDocument()
  })

  it('shows empty state when no reports match filter', async () => {
    render(<MemoryRouter><IftaPage /></MemoryRouter>)
    await screen.findByText('T-100')
    fireEvent.change(screen.getByPlaceholderText('Truck name or VIN…'), { target: { value: 'nonexistent' } })
    expect(screen.getByText('No IFTA reports found.')).toBeInTheDocument()
  })
})
