import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TrailerFiles from '../TrailerFiles'

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return {
    ...actual,
    trailersService: {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      storeFile: vi.fn(),
      deleteStoredFile: vi.fn(),
    },
  }
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

  it('shows a Store button only for the annual_inspection slot', () => {
    render(
      <TrailerFiles
        trailerId={5}
        trailer={{
          ...emptyTrailer,
          annual_inspection_file: '/media/trailers/inspections/a.pdf',
          registration_file: '/media/trailers/registration/b.pdf',
        }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByTitle('Send Annual Inspection to Store')).toBeInTheDocument()
    expect(screen.queryByTitle('Send Registration to Store')).not.toBeInTheDocument()
  })

  it('stores the annual inspection file with the legacy confirm text', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailersService.storeFile.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(
      <TrailerFiles
        trailerId={5}
        trailer={{ ...emptyTrailer, annual_inspection_file: '/media/trailers/inspections/a.pdf' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByTitle('Send Annual Inspection to Store'))
    expect(window.confirm).toHaveBeenCalledWith('Are you sure store the Annual Inspection?')
    await waitFor(() => expect(trailersService.storeFile).toHaveBeenCalledWith(5, 'annual_inspection'))
    expect(onChange).toHaveBeenCalled()
  })

  it('renders the stored-files history and deletes with the legacy confirm text', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailersService.deleteStoredFile.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(
      <TrailerFiles
        trailerId={5}
        trailer={{
          ...emptyTrailer,
          stored_files: [{ id: 9, file: '/media/trailers/stored/old.pdf', date: '2025-01-01' }],
        }}
        onChange={onChange}
      />
    )
    expect(screen.getAllByText('Annual Inspection')).toHaveLength(2)
    expect(screen.getByText('2025-01-01')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Delete'))
    expect(window.confirm).toHaveBeenCalledWith('Are you sure delete the file?')
    await waitFor(() => expect(trailersService.deleteStoredFile).toHaveBeenCalledWith(5, 9))
    expect(onChange).toHaveBeenCalled()
  })
})
