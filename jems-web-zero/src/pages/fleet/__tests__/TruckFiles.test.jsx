import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TruckFiles from '../TruckFiles'

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { uploadFile: vi.fn(), deleteFile: vi.fn() } }
})

import { trucksService } from '../../../services/trucks'

const emptyTruck = {
  avi_file: null, registration_file: null, agreement_file: null,
  leased_file: null, photo: null,
}

beforeEach(() => vi.clearAllMocks())

describe('TruckFiles', () => {
  it('renders all four document slots plus the photo control', () => {
    render(<TruckFiles truckId={7} truck={emptyTruck} onChange={vi.fn()} />)
    expect(screen.getByRole('cell', { name: 'AVI' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Registration' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Contract / Agreement' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Leased Agreement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add Photo/i })).toBeInTheDocument()
  })

  it('renders a download link (with API origin) when a slot has a file', () => {
    render(
      <TruckFiles
        truckId={7}
        truck={{ ...emptyTruck, leased_file: '/media/trucks/leased/a.pdf' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
      'href', 'http://localhost:8000/media/trucks/leased/a.pdf'
    )
  })

  it('uploads to the leased slot and refreshes', async () => {
    trucksService.uploadFile.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(<TruckFiles truckId={7} truck={emptyTruck} onChange={onChange} />)

    const file = new File(['x'], 'lease.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Leased Agreement file'), { target: { files: [file] } })

    await waitFor(() => expect(trucksService.uploadFile).toHaveBeenCalledWith(7, 'leased', file))
    expect(onChange).toHaveBeenCalled()
  })

  it('uploads a photo via the photo control', async () => {
    trucksService.uploadFile.mockResolvedValue({ data: {} })
    render(<TruckFiles truckId={7} truck={emptyTruck} onChange={vi.fn()} />)
    const file = new File(['x'], 'truck.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Truck photo'), { target: { files: [file] } })
    await waitFor(() => expect(trucksService.uploadFile).toHaveBeenCalledWith(7, 'photo', file))
  })

  it('clears a file after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trucksService.deleteFile.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(
      <TruckFiles
        truckId={7}
        truck={{ ...emptyTruck, avi_file: '/media/trucks/avi/x.pdf' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByTitle('Remove AVI'))
    await waitFor(() => expect(trucksService.deleteFile).toHaveBeenCalledWith(7, 'avi'))
    expect(onChange).toHaveBeenCalled()
  })
})
