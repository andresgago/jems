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
    uploadFile: vi.fn(),
    clearFile: vi.fn(),
  },
  ACCIDENT_FILE_SLOTS: ['police_report', 'post_accident'],
}))

vi.mock('../../../utils/media', () => ({
  mediaUrl: (v) => v ? `http://localhost:8000${v}` : null,
}))

import { useAccident } from '../../../hooks/useAccident'
import { accidentsService } from '../../../services/accidents'

const accident = {
  id: 7,
  date: '2024-06-15T10:30:00Z',
  crash_number: 'CR-007',
  address: 'I-90 Mile 55',
  driver: 5,
  driver_name: 'Maria Lopez',
  truck: 10,
  truck_number: '4279',
  trailer: 20,
  trailer_number: 'TR-500',
  city: 3,
  city_name: 'Charlotte (NC)',
  state: 12,
  state_name: 'North Carolina',
  tow_aways: true,
  death_count: 0,
  fatal_injuries: 2,
  police_report_file: null,
  post_accident_file: null,
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
  it('shows accident heading with id', () => {
    renderDetail()
    expect(screen.getByText(/Accident #7/)).toBeInTheDocument()
  })

  it('shows FMCSA crash number and address', () => {
    renderDetail()
    expect(screen.getByText('CR-007')).toBeInTheDocument()
    expect(screen.getByText('I-90 Mile 55')).toBeInTheDocument()
  })

  it('shows resolved driver name', () => {
    renderDetail()
    expect(screen.getByText('Maria Lopez')).toBeInTheDocument()
  })

  it('shows resolved truck number', () => {
    renderDetail()
    expect(screen.getByText('4279')).toBeInTheDocument()
  })

  it('shows resolved trailer number', () => {
    renderDetail()
    expect(screen.getByText('TR-500')).toBeInTheDocument()
  })

  it('shows city name', () => {
    renderDetail()
    expect(screen.getByText('Charlotte (NC)')).toBeInTheDocument()
  })

  it('shows state name', () => {
    renderDetail()
    expect(screen.getByText('North Carolina')).toBeInTheDocument()
  })

  it('shows tow-aways Yes in FMCSA Info', () => {
    renderDetail()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('shows fatal injuries count', () => {
    renderDetail()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows Documents section with Police Report and Post Accident rows', () => {
    renderDetail()
    expect(screen.getByText('Police Report')).toBeInTheDocument()
    expect(screen.getByText('Post Accident')).toBeInTheDocument()
  })

  it('shows "Not uploaded" for missing files', () => {
    renderDetail()
    const notUploaded = screen.getAllByText('Not uploaded')
    expect(notUploaded.length).toBe(2)
  })

  it('shows download link when file present', () => {
    useAccident.mockReturnValue({
      accident: { ...accident, police_report_file: '/media/accidents/report.pdf' },
      loading: false, error: null, refresh: mockRefresh,
    })
    renderDetail()
    const downloadLink = screen.getByRole('link', { name: /Download/i })
    expect(downloadLink.getAttribute('href')).toContain('/media/accidents/report.pdf')
  })

  it('calls clearFile on remove file confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    accidentsService.clearFile.mockResolvedValue({})
    useAccident.mockReturnValue({
      accident: { ...accident, post_accident_file: '/media/accidents/post.pdf' },
      loading: false, error: null, refresh: mockRefresh,
    })
    renderDetail()
    const removeBtn = screen.getByTitle('Remove')
    fireEvent.click(removeBtn)
    await waitFor(() => expect(accidentsService.clearFile).toHaveBeenCalledWith(7, 'post_accident'))
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows Pictures section with "No pictures uploaded"', () => {
    renderDetail()
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

  it('shows picture gallery when pictures are present', () => {
    useAccident.mockReturnValue({
      accident: {
        ...accident,
        pictures: [{ id: 100, file: '/media/acc/pic1.jpg', description: 'Front view' }],
      },
      loading: false, error: null, refresh: mockRefresh,
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
      loading: false, error: null, refresh: mockRefresh,
    })
    renderDetail()
    fireEvent.click(screen.getByTitle('Remove'))
    await waitFor(() => expect(accidentsService.deletePicture).toHaveBeenCalledWith(7, 100))
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows loading spinner when loading', () => {
    useAccident.mockReturnValue({ accident: null, loading: true, error: null, refresh: mockRefresh })
    const { container } = renderDetail()
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
