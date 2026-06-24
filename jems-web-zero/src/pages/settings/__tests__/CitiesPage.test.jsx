import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CitiesPage from '../CitiesPage'

vi.mock('../../../services/cities', async () => {
  const actual = await vi.importActual('../../../services/cities')
  return {
    ...actual,
    citiesService: {
      list: vi.fn(),
      toggleStatus: vi.fn(),
    },
  }
})

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(() => [
    { id: 44, name: 'Texas', abbreviation: 'TX' },
    { id: 34, name: 'North Carolina', abbreviation: 'NC' },
  ]),
}))

import { citiesService } from '../../../services/cities'

const cities = [
  { id: 1, name: 'Charlotte', zip: '28201', state: 34, state_name: 'North Carolina', state_abbreviation: 'NC', active: true, timezone: 'America/New_York' },
  { id: 2, name: 'Houston', zip: '77001', state: 44, state_name: 'Texas', state_abbreviation: 'TX', active: false, timezone: 'America/Chicago' },
]

const pagedResponse = { count: 2, results: cities, next: null, previous: null }

beforeEach(() => {
  vi.clearAllMocks()
  citiesService.list.mockResolvedValue({ data: pagedResponse })
})

describe('CitiesPage', () => {
  it('renders city rows returned by the service', async () => {
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    expect(await screen.findByText('Charlotte')).toBeInTheDocument()
    expect(screen.getByText('Houston')).toBeInTheDocument()
  })

  it('shows zip codes', async () => {
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    await screen.findByText('Charlotte')
    expect(screen.getByText('28201')).toBeInTheDocument()
    expect(screen.getByText('77001')).toBeInTheDocument()
  })

  it('shows Active badge for active cities', async () => {
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    await screen.findByText('Charlotte')
    const badges = screen.getAllByText('Active')
    // At least one Active badge exists (excluding select options)
    const badgeEls = badges.filter(el => el.classList.contains('badge'))
    expect(badgeEls.length).toBeGreaterThan(0)
  })

  it('shows Inactive badge for inactive cities', async () => {
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    await screen.findByText('Charlotte')
    const inactiveEls = screen.getAllByText('Inactive')
    const badge = inactiveEls.find(el => el.classList.contains('badge'))
    expect(badge).toBeInTheDocument()
  })

  it('shows total city count', async () => {
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    expect(await screen.findByText('2 cities')).toBeInTheDocument()
  })

  it('calls service with q param on search input change after debounce', async () => {
    citiesService.list.mockResolvedValue({ data: { count: 0, results: [], next: null, previous: null } })
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    await waitFor(() => expect(citiesService.list).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByPlaceholderText(/Houston or/i), { target: { value: 'Charlotte' } })

    // Wait for debounce (300ms) and subsequent list call
    await waitFor(() => {
      const calls = citiesService.list.mock.calls
      return calls.some(([params]) => params.q === 'Charlotte')
    }, { timeout: 2000 })
  })

  it('calls toggleStatus and refreshes on confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    citiesService.toggleStatus.mockResolvedValue({ data: { id: 1, active: false } })
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    await screen.findByText('Charlotte')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(citiesService.toggleStatus).toHaveBeenCalledWith(1))
    vi.restoreAllMocks()
  })

  it('does not toggle without confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    await screen.findByText('Charlotte')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    expect(citiesService.toggleStatus).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('has a Create City link', async () => {
    render(<MemoryRouter><CitiesPage /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: /Create City/i })).toBeInTheDocument()
  })
})
