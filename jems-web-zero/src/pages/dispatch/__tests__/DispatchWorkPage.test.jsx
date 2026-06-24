import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DispatchWorkPage from '../DispatchWorkPage'

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { user_id: 1, roles: ['admin'] } }),
}))

vi.mock('../../../services/dispatch', async () => {
  const actual = await vi.importActual('../../../services/dispatch')
  return {
    ...actual,
    dispatchWorkService: {
      list: vi.fn(),
      finish: vi.fn(),
      markPaid: vi.fn(),
    },
  }
})

import { dispatchWorkService } from '../../../services/dispatch'

const SESSIONS = [
  {
    id: 1,
    title: 'Morning shift',
    dispatcher: 10,
    dispatcher_name: 'Lilian Hernandez',
    start: '2024-01-15T08:00:00Z',
    end: '2024-01-15T16:00:00Z',
    is_finished: true,
    is_paid: false,
    duration_hours: 8.0,
  },
  {
    id: 2,
    title: 'Evening shift',
    dispatcher: 11,
    dispatcher_name: 'Pedro Cancino',
    start: '2024-01-16T16:00:00Z',
    end: '2024-01-16T22:00:00Z',
    is_finished: false,
    is_paid: false,
    duration_hours: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  dispatchWorkService.list.mockResolvedValue({ data: SESSIONS })
})

describe('DispatchWorkPage', () => {
  it('renders the heading for admin calendar', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    expect(await screen.findByText('Dispatchers Calendar')).toBeInTheDocument()
  })

  it('renders the heading for my calendar', async () => {
    render(<MemoryRouter><DispatchWorkPage selfOnly={true} /></MemoryRouter>)
    expect(await screen.findByText('My Work Sessions')).toBeInTheDocument()
  })

  it('lists sessions from the service', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    expect(await screen.findByText('Morning shift')).toBeInTheDocument()
    expect(screen.getByText('Evening shift')).toBeInTheDocument()
    expect(screen.getByText('Lilian Hernandez')).toBeInTheDocument()
    expect(screen.getByText('Pedro Cancino')).toBeInTheDocument()
  })

  it('shows Done badge for finished session and In Progress for unfinished', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Morning shift')
    expect(screen.getByText('Done')).toBeInTheDocument()
    // "In Progress" appears in both the filter dropdown and the badge
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Paid/Unpaid badges', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Morning shift')
    expect(screen.getAllByText('Unpaid').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by title', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Morning shift')
    fireEvent.change(screen.getByPlaceholderText('Search dispatcher or title…'), {
      target: { value: 'evening' },
    })
    expect(screen.queryByText('Morning shift')).not.toBeInTheDocument()
    expect(screen.getByText('Evening shift')).toBeInTheDocument()
  })

  it('filters by dispatcher name', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Morning shift')
    fireEvent.change(screen.getByPlaceholderText('Search dispatcher or title…'), {
      target: { value: 'pedro' },
    })
    expect(screen.queryByText('Lilian Hernandez')).not.toBeInTheDocument()
    expect(screen.getByText('Pedro Cancino')).toBeInTheDocument()
  })

  it('shows session count in footer', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    expect(await screen.findByText('2 sessions')).toBeInTheDocument()
  })

  it('shows Finish button only for unfinished sessions', async () => {
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Morning shift')
    const finishButtons = screen.getAllByTitle('Finish')
    expect(finishButtons).toHaveLength(1)
  })

  it('finishes a session on confirmed click', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    dispatchWorkService.finish.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Evening shift')
    fireEvent.click(screen.getByTitle('Finish'))
    await waitFor(() => expect(dispatchWorkService.finish).toHaveBeenCalledWith(2))
  })

  it('does not finish when confirm cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    await screen.findByText('Evening shift')
    fireEvent.click(screen.getByTitle('Finish'))
    expect(dispatchWorkService.finish).not.toHaveBeenCalled()
  })

  it('shows empty state when no sessions', async () => {
    dispatchWorkService.list.mockResolvedValue({ data: [] })
    render(<MemoryRouter><DispatchWorkPage /></MemoryRouter>)
    expect(await screen.findByText('No work sessions found.')).toBeInTheDocument()
  })

  it('passes dispatcher filter when selfOnly=true', async () => {
    render(<MemoryRouter><DispatchWorkPage selfOnly={true} /></MemoryRouter>)
    await screen.findByText('My Work Sessions')
    expect(dispatchWorkService.list).toHaveBeenCalledWith(
      expect.objectContaining({ dispatcher: 1 })
    )
  })
})
