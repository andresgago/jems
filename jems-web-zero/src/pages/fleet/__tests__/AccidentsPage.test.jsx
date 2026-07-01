import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccidentsPage from '../AccidentsPage'

vi.mock('../../../services/accidents', () => ({
  accidentsService: {
    list:          vi.fn(),
    destroy:       vi.fn(),
    bulkDelete:    vi.fn(),
    addPicture:    vi.fn(),
    uploadFile:    vi.fn(),
    clearFile:     vi.fn(),
  },
  ACCIDENT_FILE_SLOTS: ['police_report', 'post_accident'],
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { list: vi.fn() } }
})

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return { ...actual, driversService: { list: vi.fn() } }
})

vi.mock('../../../components/DateRangePicker', () => ({
  default: ({ onApply }) => (
    <div data-testid="date-range-picker">
      <button onClick={() => onApply({ start: '2024-01-01', end: '2024-12-31' })}>Apply</button>
    </div>
  ),
}))

import { accidentsService } from '../../../services/accidents'
import { trucksService } from '../../../services/trucks'
import { trailersService } from '../../../services/trailers'
import { driversService } from '../../../services/drivers'

const accidents = [
  {
    id: 1,
    date: '2024-03-10T14:30:00Z',
    crash_number: 'CR-001',
    truck: 10,
    truck_number: 'T-100',
    trailer: 20,
    trailer_number: 'TR-200',
    driver: 5,
    driver_name: 'John Doe',
    city: 3,
    city_name: 'Charlotte (NC)',
    state: 1,
    address: 'I-95 Mile 42',
    tow_aways: true,
    death_count: 0,
    fatal_injuries: 0,
    picture_count: 4,
    police_report_file: null,
    post_accident_file: null,
  },
  {
    id: 2,
    date: '2024-04-20T09:00:00Z',
    crash_number: 'CR-002',
    truck: null,
    truck_number: null,
    trailer: null,
    trailer_number: null,
    driver: null,
    driver_name: null,
    city: null,
    city_name: null,
    state: null,
    address: '',
    tow_aways: false,
    death_count: 0,
    fatal_injuries: 0,
    picture_count: 0,
    police_report_file: null,
    post_accident_file: null,
  },
]

const trucks = [{ id: 10, number: 'T-100' }]
const trailers = [{ id: 20, number: 'TR-200' }]
const drivers = [{ id: 5, first_name: 'John', last_name: 'Doe' }]

beforeEach(() => {
  vi.clearAllMocks()
  accidentsService.list.mockResolvedValue({ data: accidents })
  trucksService.list.mockResolvedValue({ data: trucks })
  trailersService.list.mockResolvedValue({ data: trailers })
  driversService.list.mockResolvedValue({ data: drivers })
})

describe('AccidentsPage', () => {
  it('renders accident rows with crash number', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    expect(await screen.findByText('CR-001')).toBeInTheDocument()
    expect(screen.getByText('CR-002')).toBeInTheDocument()
  })

  it('shows driver name column', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    // 'John Doe' appears in both the row and the driver filter select option
    expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1)
  })

  it('shows truck number column', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    // 'T-100' appears in both the row and the truck filter select option
    expect(screen.getAllByText('T-100').length).toBeGreaterThanOrEqual(1)
  })

  it('shows city name column', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    expect(screen.getByText('Charlotte (NC)')).toBeInTheDocument()
  })

  it('shows picture count badge', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows New Accident link', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    const link = await screen.findByRole('link', { name: /New Accident/i })
    expect(link.getAttribute('href')).toBe('/fleet/accidents/create')
  })

  it('shows view and edit links for accident', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const viewLinks = screen.getAllByTitle('View')
    const editLinks = screen.getAllByTitle('Edit')
    expect(viewLinks[0].getAttribute('href')).toBe('/fleet/accidents/1')
    expect(editLinks[0].getAttribute('href')).toBe('/fleet/accidents/1/edit')
  })

  it('shows driver select filter with options', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const driverOpt = screen.getByRole('option', { name: /John Doe/i })
    expect(driverOpt).toBeInTheDocument()
  })

  it('shows truck select filter with options', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const truckOpt = screen.getByRole('option', { name: /T-100/i })
    expect(truckOpt).toBeInTheDocument()
  })

  it('inline driver filter hides non-matching rows', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const driverSelect = screen.getByRole('option', { name: /John Doe/i }).closest('select')
    fireEvent.change(driverSelect, { target: { value: '5' } })
    expect(screen.getByText('CR-001')).toBeInTheDocument()
    expect(screen.queryByText('CR-002')).not.toBeInTheDocument()
  })

  it('search filter by crash number', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const searchInput = screen.getByPlaceholderText(/FMCSA Crash Report Number/i)
    fireEvent.change(searchInput, { target: { value: 'CR-001' } })
    expect(screen.getByText('CR-001')).toBeInTheDocument()
    expect(screen.queryByText('CR-002')).not.toBeInTheDocument()
  })

  it('shows item count in heading', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    expect(screen.getByText(/2 items/i)).toBeInTheDocument()
  })

  it('select all checkbox selects all filtered rows', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const checkboxes = screen.getAllByRole('checkbox')
    const selectAll = checkboxes[0]
    fireEvent.click(selectAll)
    const rowCheckboxes = checkboxes.slice(1)
    rowCheckboxes.forEach((cb) => expect(cb.checked).toBe(true))
  })

  it('shows bulk delete bar when items selected', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(screen.getByText(/\(1 selected\)/i)).toBeInTheDocument()
  })

  it('bulk deletes selected accidents through the bulk endpoint', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    accidentsService.bulkDelete.mockResolvedValue({})
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: /Delete All/i }))
    await waitFor(() => expect(accidentsService.bulkDelete).toHaveBeenCalledWith([1]))
  })

  it('deletes an accident after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    accidentsService.destroy.mockResolvedValue({})
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    await waitFor(() => expect(accidentsService.destroy).toHaveBeenCalledWith(1))
  })

  it('does not delete when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(accidentsService.destroy).not.toHaveBeenCalled()
  })

  it('renders date range picker', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
  })

  it('loads with legacy Show all date type by default', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    expect(accidentsService.list).toHaveBeenCalledWith({ date_type: '3' })
    expect(screen.getByRole('option', { name: /Show all/i }).selected).toBe(true)
  })

  it('applies date range only when Show by date is selected', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    fireEvent.click(screen.getByText('Apply'))
    const dateTypeSelect = screen.getByRole('option', { name: /Show by date/i }).closest('select')
    fireEvent.change(dateTypeSelect, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /Search/i }))
    await waitFor(() => {
      expect(accidentsService.list).toHaveBeenLastCalledWith({
        date_type: '1',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
      })
    })
  })
})
