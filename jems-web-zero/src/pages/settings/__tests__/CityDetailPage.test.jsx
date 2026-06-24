import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CityDetailPage from '../CityDetailPage'

vi.mock('../../../hooks/useCity', () => ({
  useCity: vi.fn(),
}))

vi.mock('../../../services/cities', async () => {
  const actual = await vi.importActual('../../../services/cities')
  return {
    ...actual,
    citiesService: { toggleStatus: vi.fn() },
  }
})

import { useCity } from '../../../hooks/useCity'
import { citiesService } from '../../../services/cities'

const city = {
  id: 5,
  name: 'Charlotte',
  zip: '28201',
  state: 34,
  state_abbreviation: 'NC',
  timezone: 'America/New_York',
  active: true,
  state_data: { id: 34, name: 'North Carolina', abbreviation: 'NC' },
}

function renderDetail(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/settings/cities/${id}`]}>
      <Routes>
        <Route path="/settings/cities/:id" element={<CityDetailPage />} />
        <Route path="/settings/cities" element={<div>Cities list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useCity.mockReturnValue({ city, loading: false, error: null, reload: vi.fn() })
})

describe('CityDetailPage', () => {
  it('renders city name and zip in heading', () => {
    renderDetail()
    expect(screen.getByText(/Charlotte, NC 28201/)).toBeInTheDocument()
  })

  it('shows state name', () => {
    renderDetail()
    expect(screen.getByText(/North Carolina \(NC\)/)).toBeInTheDocument()
  })

  it('shows timezone', () => {
    renderDetail()
    expect(screen.getByText('America/New_York')).toBeInTheDocument()
  })

  it('shows Active status badge', () => {
    renderDetail()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Toggle Status button', () => {
    renderDetail()
    expect(screen.getByRole('button', { name: /Toggle Status/i })).toBeInTheDocument()
  })

  it('calls toggleStatus and reloads on confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const reload = vi.fn()
    citiesService.toggleStatus.mockResolvedValue({ data: { id: 5, active: false } })
    useCity.mockReturnValue({ city, loading: false, error: null, reload })

    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /Toggle Status/i }))
    await waitFor(() => expect(citiesService.toggleStatus).toHaveBeenCalledWith(5))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    vi.restoreAllMocks()
  })

  it('shows loading spinner while fetching', () => {
    useCity.mockReturnValue({ city: null, loading: true, error: null, reload: vi.fn() })
    renderDetail()
    expect(document.querySelector('.spinner-border')).toBeInTheDocument()
  })

  it('shows not found message on error', () => {
    useCity.mockReturnValue({ city: null, loading: false, error: new Error('404'), reload: vi.fn() })
    renderDetail()
    expect(screen.getByText('City not found.')).toBeInTheDocument()
  })
})
