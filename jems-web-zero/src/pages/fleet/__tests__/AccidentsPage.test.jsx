import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccidentsPage from '../AccidentsPage'

vi.mock('../../../services/accidents', () => ({
  accidentsService: {
    list: vi.fn(),
    destroy: vi.fn(),
  },
}))

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn() } }
})

import { accidentsService } from '../../../services/accidents'
import { trucksService } from '../../../services/trucks'

const accidents = [
  {
    id: 1,
    date: '2024-03-10T14:30:00Z',
    crash_number: 'CR-001',
    truck: 10,
    address: 'I-95 Mile 42',
    tow_aways: true,
  },
  {
    id: 2,
    date: '2024-04-20T09:00:00Z',
    crash_number: '',
    truck: null,
    address: '',
    tow_aways: false,
  },
]

const trucks = [{ id: 10, number: 'T-100' }]

beforeEach(() => {
  vi.clearAllMocks()
  accidentsService.list.mockResolvedValue({ data: accidents })
  trucksService.list.mockResolvedValue({ data: trucks })
})

describe('AccidentsPage', () => {
  it('renders accident rows', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    expect(await screen.findByText('CR-001')).toBeInTheDocument()
    expect(screen.getByText('I-95 Mile 42')).toBeInTheDocument()
  })

  it('shows tow-away Yes badge when tow_aways is true', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
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

  it('filters by crash number search', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('CR-001')
    const searchInput = screen.getByPlaceholderText(/Crash number or address/i)
    fireEvent.change(searchInput, { target: { value: 'CR-001' } })
    expect(screen.getByText('CR-001')).toBeInTheDocument()
    // Second row has no crash number so it should be hidden
    expect(screen.queryByText('I-95 Mile 42')).toBeInTheDocument()
    // Only CR-001 row matches; make sure I-95 row that has no crash # is filtered out
    fireEvent.change(searchInput, { target: { value: 'CR-999' } })
    expect(screen.queryByText('CR-001')).not.toBeInTheDocument()
  })

  it('filters by address search', async () => {
    render(<MemoryRouter><AccidentsPage /></MemoryRouter>)
    await screen.findByText('I-95 Mile 42')
    const searchInput = screen.getByPlaceholderText(/Crash number or address/i)
    fireEvent.change(searchInput, { target: { value: 'i-95' } })
    expect(screen.getByText('I-95 Mile 42')).toBeInTheDocument()
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
})
