import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AccidentDetailPage from '../AccidentDetailPage'

vi.mock('../../../hooks/useAccident', () => ({
  useAccident: vi.fn(),
}))

vi.mock('../../../services/accidents', () => ({
  accidentsService: {
    destroy: vi.fn(),
    addPicture: vi.fn(),
    deletePicture: vi.fn(),
  },
}))

import { useAccident } from '../../../hooks/useAccident'
import { accidentsService } from '../../../services/accidents'

const accident = {
  id: 7,
  date: '2024-06-15T10:30:00Z',
  crash_number: 'CR-007',
  address: 'I-90 Mile 55',
  truck: 10,
  trailer: null,
  driver: null,
  tow_aways: true,
  death_count: 0,
  fatal_injuries: 2,
  pictures: [],
}

const mockRefresh = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  useAccident.mockReturnValue({ accident, loading: false, error: null, refresh: mockRefresh })
})

const renderDetail = (id = '7') =>
  render(
    <MemoryRouter initialEntries={[`/fleet/accidents/${id}`]}>
      <Routes>
        <Route path="/fleet/accidents/:id" element={<AccidentDetailPage />} />
        <Route path="/fleet/accidents" element={<div>Accidents List</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('AccidentDetailPage', () => {
  it('shows accident heading with id', async () => {
    renderDetail()
    expect(screen.getByText(/Accident #7/)).toBeInTheDocument()
  })

  it('shows crash number and address in Accident Info', () => {
    renderDetail()
    expect(screen.getByText('CR-007')).toBeInTheDocument()
    expect(screen.getByText('I-90 Mile 55')).toBeInTheDocument()
  })

  it('shows tow-aways Yes in FMCSA Info', () => {
    renderDetail()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('shows fatal injuries count', () => {
    renderDetail()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows Pictures section', () => {
    renderDetail()
    expect(screen.getByText('Pictures')).toBeInTheDocument()
    expect(screen.getByText('No pictures uploaded.')).toBeInTheDocument()
  })

  it('shows Add Picture button', () => {
    renderDetail()
    expect(screen.getByText(/Add Picture/)).toBeInTheDocument()
  })

  it('shows Edit link pointing to edit page', () => {
    renderDetail()
    const editLink = screen.getByRole('link', { name: /Edit/i })
    expect(editLink.getAttribute('href')).toBe('/fleet/accidents/7/edit')
  })

  it('shows pictures when accident has them', () => {
    useAccident.mockReturnValue({
      accident: {
        ...accident,
        pictures: [
          { id: 100, file: '/media/acc/pic1.jpg', description: 'Front view' },
        ],
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    })
    renderDetail()
    expect(screen.getByAltText('Front view')).toBeInTheDocument()
    expect(screen.getByTitle('Remove')).toBeInTheDocument()
  })

  it('calls deletePicture and refreshes on remove confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    accidentsService.deletePicture.mockResolvedValue({})
    useAccident.mockReturnValue({
      accident: {
        ...accident,
        pictures: [{ id: 100, file: '/media/acc/pic1.jpg', description: 'Front view' }],
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    })
    renderDetail()
    fireEvent.click(screen.getByTitle('Remove'))
    await waitFor(() => expect(accidentsService.deletePicture).toHaveBeenCalledWith(7, 100))
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows loading spinner when loading', () => {
    useAccident.mockReturnValue({ accident: null, loading: true, error: null, refresh: mockRefresh })
    const { container } = renderDetail()
    // Bootstrap spinner rendered as <div className="spinner-border"> — no role="status" in our JSX
    expect(container.querySelector('.spinner-border')).toBeInTheDocument()
  })

  it('shows error message when accident not found', () => {
    useAccident.mockReturnValue({ accident: null, loading: false, error: new Error('404'), refresh: mockRefresh })
    renderDetail()
    expect(screen.getByText('Accident not found.')).toBeInTheDocument()
  })

  it('deletes accident and navigates to list on confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    accidentsService.destroy.mockResolvedValue({})
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
    await waitFor(() => expect(accidentsService.destroy).toHaveBeenCalledWith('7'))
    expect(screen.getByText('Accidents List')).toBeInTheDocument()
  })
})
