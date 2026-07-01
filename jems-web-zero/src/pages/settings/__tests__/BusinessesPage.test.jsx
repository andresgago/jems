import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import BusinessesPage from '../BusinessesPage'

vi.mock('../../../services/businesses', async () => {
  const actual = await vi.importActual('../../../services/businesses')
  return {
    ...actual,
    businessesService: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
      toggleStatus: vi.fn(),
    },
  }
})

vi.mock('../../../services/cities', () => ({
  citiesService: { list: vi.fn() },
}))

vi.mock('../../../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { businessesService } from '../../../services/businesses'
import { citiesService } from '../../../services/cities'
import { useAuth } from '../../../contexts/useAuth'

const businesses = [
  {
    id: 1,
    name: 'Acme Warehouse',
    address: '123 Dock St',
    city: 10,
    city_display: 'Charlotte, NC',
    status: 1,
    rating: 8,
    can_delete: false,
    load_count: 2,
  },
  {
    id: 2,
    name: 'Beta DC',
    address: '',
    city: null,
    city_display: '',
    status: 0,
    rating: 0,
    can_delete: true,
    load_count: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { roles: ['admin'] } })
  businessesService.list.mockResolvedValue({ data: { count: 2, results: businesses } })
  businessesService.get.mockResolvedValue({ data: businesses[0] })
  businessesService.create.mockResolvedValue({ data: { id: 3, name: 'New Business' } })
  businessesService.update.mockResolvedValue({ data: businesses[0] })
  businessesService.destroy.mockResolvedValue({ data: null })
  businessesService.toggleStatus.mockResolvedValue({ data: { ...businesses[0], status: 0 } })
  citiesService.list.mockResolvedValue({
    data: { results: [{ id: 10, name: 'Charlotte', state_abbreviation: 'NC' }] },
  })
})

describe('BusinessesPage', () => {
  it('renders the legacy grid rows and count', async () => {
    render(<BusinessesPage />)
    expect(await screen.findByText('Acme Warehouse')).toBeInTheDocument()
    expect(screen.getByText('Beta DC')).toBeInTheDocument()
    expect(screen.getByText('Showing 1-2 of 2 items.')).toBeInTheDocument()
    expect(screen.getByText('(8)')).toBeInTheDocument()
    expect(screen.getByText('(Not rating yet)')).toBeInTheDocument()
  })

  it('sends column filters to the backend', async () => {
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    fireEvent.change(screen.getByPlaceholderText('Find by name'), { target: { value: 'Acme' } })
    await waitFor(() => {
      expect(businessesService.list).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Acme' }))
    })
  })

  it('opens view modal with detail data', async () => {
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    fireEvent.click(screen.getAllByTitle('View')[0])
    expect(await screen.findByText('Business: Acme Warehouse')).toBeInTheDocument()
    expect(businessesService.get).toHaveBeenCalledWith(1)
    expect(screen.getByText('Loads')).toBeInTheDocument()
  })

  it('creates a new business from the modal', async () => {
    render(<BusinessesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /New Business/i }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Business' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(businessesService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Business', status: 1 }))
    })
  })

  it('updates an existing business from the modal', async () => {
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    fireEvent.click(screen.getAllByTitle('Update')[0])
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Updated Address' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(businessesService.update).toHaveBeenCalledWith(1, expect.objectContaining({ address: 'Updated Address' }))
    })
  })

  it('toggles status after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(businessesService.toggleStatus).toHaveBeenCalledWith(1))
    vi.restoreAllMocks()
  })

  it('does not allow deleting a business used by loads', async () => {
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    expect(screen.getAllByTitle('Delete')[0]).toBeDisabled()
  })

  it('deletes an unused business after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<BusinessesPage />)
    await screen.findByText('Beta DC')
    fireEvent.click(screen.getAllByTitle('Delete')[1])
    await waitFor(() => expect(businessesService.destroy).toHaveBeenCalledWith(2))
    vi.restoreAllMocks()
  })

  it('hides the Rating column and cells for a non-admin role', async () => {
    useAuth.mockReturnValue({ user: { roles: ['dispatcher'] } })
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    expect(screen.queryByText('Rating', { selector: 'th' })).not.toBeInTheDocument()
    expect(screen.queryByText('(8)')).not.toBeInTheDocument()
    expect(screen.queryByText('(Not rating yet)')).not.toBeInTheDocument()
  })

  it('shows the Rating column and cells for the admin role', async () => {
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    expect(screen.getByText('Rating', { selector: 'th' })).toBeInTheDocument()
    expect(screen.getByText('(8)')).toBeInTheDocument()
    expect(screen.getByText('(Not rating yet)')).toBeInTheDocument()
  })

  it('shows the Rating column for the root role', async () => {
    useAuth.mockReturnValue({ user: { roles: ['root'] } })
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    expect(screen.getByText('Rating', { selector: 'th' })).toBeInTheDocument()
  })

  it('hides the Rating row in the view modal for a non-admin role', async () => {
    useAuth.mockReturnValue({ user: { roles: ['dispatcher'] } })
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    fireEvent.click(screen.getAllByTitle('View')[0])
    expect(await screen.findByText('Business: Acme Warehouse')).toBeInTheDocument()
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.queryByText('Rating', { selector: 'th' })).not.toBeInTheDocument()
  })

  it('shows the Rating row in the view modal for the admin role', async () => {
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    fireEvent.click(screen.getAllByTitle('View')[0])
    expect(await screen.findByText('Business: Acme Warehouse')).toBeInTheDocument()
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Rating', { selector: 'th' })).toBeInTheDocument()
  })

  it('does not crash when useAuth returns no user (unauthenticated edge case)', async () => {
    useAuth.mockReturnValue(undefined)
    render(<BusinessesPage />)
    await screen.findByText('Acme Warehouse')
    expect(screen.queryByText('Rating', { selector: 'th' })).not.toBeInTheDocument()
  })
})
