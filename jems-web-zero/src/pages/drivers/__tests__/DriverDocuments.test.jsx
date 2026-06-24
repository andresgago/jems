import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DriverDocuments from '../DriverDocuments'

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return {
    ...actual,
    driversService: { uploadDocument: vi.fn(), deleteDocument: vi.fn() },
  }
})

import { driversService } from '../../../services/drivers'

const docs = [
  { id: 10, document_type_display: 'License', expiration_date: '2030-01-01', file: '/media/drivers/documents/lic.pdf' },
]

beforeEach(() => vi.clearAllMocks())

describe('DriverDocuments', () => {
  it('renders existing documents with a download link', () => {
    render(<DriverDocuments driverId={7} documents={docs} onChange={vi.fn()} />)
    expect(screen.getByRole('cell', { name: 'License' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
      'href', 'http://localhost:8000/media/drivers/documents/lic.pdf'
    )
  })

  it('shows an empty message with no documents', () => {
    render(<DriverDocuments driverId={7} documents={[]} onChange={vi.fn()} />)
    expect(screen.getByText('No documents uploaded.')).toBeInTheDocument()
  })

  it('blocks upload when no file is chosen', async () => {
    render(<DriverDocuments driverId={7} documents={[]} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Upload/i }))
    expect(await screen.findByText('Please choose a file.')).toBeInTheDocument()
    expect(driversService.uploadDocument).not.toHaveBeenCalled()
  })

  it('uploads the chosen file with type and expiration, then refreshes', async () => {
    driversService.uploadDocument.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(<DriverDocuments driverId={7} documents={[]} onChange={onChange} />)

    const file = new File(['data'], 'medcard.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Document file'), { target: { files: [file] } })
    fireEvent.change(screen.getByDisplayValue('License'), { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: /Upload/i }))

    await waitFor(() => expect(driversService.uploadDocument).toHaveBeenCalledTimes(1))
    const [driverId, payload] = driversService.uploadDocument.mock.calls[0]
    expect(driverId).toBe(7)
    expect(payload.document_type).toBe('2')
    expect(payload.file).toBe(file)
    expect(onChange).toHaveBeenCalled()
  })

  it('deletes a document after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driversService.deleteDocument.mockResolvedValue({ data: {} })
    const onChange = vi.fn()
    render(<DriverDocuments driverId={7} documents={docs} onChange={onChange} />)

    fireEvent.click(screen.getByTitle('Delete'))
    await waitFor(() => expect(driversService.deleteDocument).toHaveBeenCalledWith(10))
    expect(onChange).toHaveBeenCalled()
  })
})
