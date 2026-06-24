import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TrailerFiles from '../TrailerFiles'

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return { ...actual, trailersService: { uploadFile: vi.fn(), deleteFile: vi.fn() } }
})

import { trailersService } from '../../../services/trailers'

const emptyTrailer = {
  annual_inspection_file: null,
  registration_file: null,
  agreement_file: null,
}

beforeEach(() => vi.clearAllMocks())

describe('TrailerFiles', () => {
  it('renders all three document slots', () => {
    render(<TrailerFiles trailerId={5} trailer={emptyTrailer} onChange={vi.fn()} />)
    expect(screen.getByRole('cell', { name: 'Annual Inspection' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Registration' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Agreement' })).toBeInTheDocument()
  })

  it('does NOT render a photo section (unlike trucks)', () => {
    render(<TrailerFiles trailerId={5} trailer={emptyTrailer} onChange={vi.fn()} />)
    expect(screen.queryByLabelText(/photo/i)).not.toBeInTheDocument()
  })

  it('renders a download link (with API origin) when a slot has a file', () => {
    render(
      <TrailerFiles
        trailerId={5}
        trailer={{ ...emptyTrailer, registration_file: '/media/trailers/registration/a.pdf' }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
      'href', 'http://localhost:8000/media/trailers/registration/a.pdf'
    )
  })

  it('uploads to the annual_inspection slot and refreshes', async () => {
    trailersService.uploadFile.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(<TrailerFiles trailerId={5} trailer={emptyTrailer} onChange={onChange} />)

    const file = new File(['x'], 'ai.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Annual Inspection file'), { target: { files: [file] } })

    await waitFor(() =>
      expect(trailersService.uploadFile).toHaveBeenCalledWith(5, 'annual_inspection', file)
    )
    expect(onChange).toHaveBeenCalled()
  })

  it('clears a file after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailersService.deleteFile.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(
      <TrailerFiles
        trailerId={5}
        trailer={{ ...emptyTrailer, agreement_file: '/media/trailers/agreements/x.pdf' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByTitle('Remove Agreement'))
    await waitFor(() => expect(trailersService.deleteFile).toHaveBeenCalledWith(5, 'agreement'))
    expect(onChange).toHaveBeenCalled()
  })
})
