import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DriverPhoto from '../DriverPhoto'

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return { ...actual, driversService: { uploadPhoto: vi.fn(), deletePhoto: vi.fn() } }
})

import { driversService } from '../../../services/drivers'

beforeEach(() => vi.clearAllMocks())

describe('DriverPhoto', () => {
  it('shows a placeholder and "Add Photo" when there is no photo', () => {
    render(<DriverPhoto driverId={7} photo={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Add Photo/i })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the photo (with API origin) and a "Change" button when present', () => {
    render(<DriverPhoto driverId={7} photo="/media/drivers/photos/p.png" onChange={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute(
      'src', 'http://localhost:8000/media/drivers/photos/p.png'
    )
    expect(screen.getByRole('button', { name: /Change/i })).toBeInTheDocument()
  })

  it('uploads the chosen image and refreshes', async () => {
    driversService.uploadPhoto.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(<DriverPhoto driverId={7} photo={null} onChange={onChange} />)

    const file = new File(['x'], 'face.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Driver photo'), { target: { files: [file] } })

    await waitFor(() => expect(driversService.uploadPhoto).toHaveBeenCalledWith(7, file))
    expect(onChange).toHaveBeenCalled()
  })

  it('removes the photo after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driversService.deletePhoto.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(<DriverPhoto driverId={7} photo="/media/p.png" onChange={onChange} />)

    fireEvent.click(screen.getByTitle('Remove photo'))
    await waitFor(() => expect(driversService.deletePhoto).toHaveBeenCalledWith(7))
    expect(onChange).toHaveBeenCalled()
  })
})
