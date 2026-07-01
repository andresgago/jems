import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrailersPage from '../TrailersPage'

vi.mock('../../../services/trailers', async () => {
  const actual = await vi.importActual('../../../services/trailers')
  return {
    ...actual,
    trailersService: {
      list: vi.fn(),
      toggleStatus: vi.fn(),
      destroy: vi.fn(),
      getAviPdf: vi.fn(),
    },
  }
})

vi.mock('../../../services/users', () => ({
  usersService: { getDisplayOptions: vi.fn(), updateDisplayOptions: vi.fn() },
}))

import { trailersService } from '../../../services/trailers'
import { usersService } from '../../../services/users'

const trailers = [
  {
    id: 1,
    number: 'TRL-100',
    trailer_type_name: '53ft Dry Van',
    vin: 'VIN001',
    year: 2021,
    status: 1,
    width: 102,
    height: 13.5,
    plate_number: 'TX-001',
    plate_state_name: 'Texas',
    annual_inspection_expiration: '2020-01-01',
    annual_inspection_file: '/media/trailers/inspections/a.pdf',
    registration_file: null,
    is_rented: false,
    drop_label: 'In Yard',
    drop_status: { code: 2, is_drop: false },
  },
  {
    id: 2,
    number: 'TRL-200',
    trailer_type_name: 'Reefer',
    vin: 'VIN002',
    year: 2022,
    status: 0,
    width: 102,
    height: 13.6,
    plate_number: 'TX-002',
    plate_state_name: 'Maine',
    annual_inspection_expiration: '2030-01-01',
    annual_inspection_file: null,
    registration_file: null,
    is_rented: false,
    drop_label: 'Inactive',
    drop_status: { code: 0, is_drop: false },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  trailersService.list.mockResolvedValue({ data: trailers })
  usersService.getDisplayOptions.mockResolvedValue({ data: { trailer: 'number,VIN' } })
  usersService.updateDisplayOptions.mockResolvedValue({ data: { trailer: 'number,VIN' } })
})

describe('TrailersPage', () => {
  it('lists active and inactive trailers returned by the service', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    expect(await screen.findByText('TRL-100')).toBeInTheDocument()
    expect(screen.getByText('TRL-200')).toBeInTheDocument()
  })

  it('filters by number client-side', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')
    fireEvent.change(screen.getByPlaceholderText('Find by number'), { target: { value: 'trl-200' } })
    expect(screen.queryByText('TRL-100')).not.toBeInTheDocument()
    expect(screen.getByText('TRL-200')).toBeInTheDocument()
  })

  it('shows Showing X-Y of N items footer, print button, and Drop column', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')

    expect(screen.getByText('Showing 1-2 of 2 items.')).toBeInTheDocument()
    expect(screen.getAllByTitle('View Trailer')).toHaveLength(2)
    expect(screen.getByText('In Yard')).toBeInTheDocument()
  })

  it('renders row-desactivada class and Inactive AVI label for inactive trailers', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')
    expect(screen.getByRole('row', { name: /TRL-200/ })).toHaveClass('row-desactivada')
    expect(screen.getByRole('button', { name: 'New AVI' })).toBeInTheDocument()
  })

  it('shows the legacy empty-selection message for report and export', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')

    fireEvent.click(screen.getByRole('button', { name: /Trailers Report/i }))
    fireEvent.click(screen.getByTitle('Trailers Export'))

    expect(alert).toHaveBeenCalledWith('Please select some trailers to show')
    expect(alert).toHaveBeenCalledTimes(2)
  })

  it('opens report for selected trailers', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')

    fireEvent.click(screen.getByLabelText('Select trailer TRL-100'))
    fireEvent.click(screen.getByRole('button', { name: /Trailers Report/i }))

    expect(open).toHaveBeenCalledWith(
      '/print/trailers?ids=1',
      '_blank',
      'toolbar=yes,scrollbars=yes,menubar=yes'
    )
  })

  it('opens Trailers in Drop unconditionally (no selection required)', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')

    fireEvent.click(screen.getByRole('button', { name: /Trailers in Drop/i }))

    expect(open).toHaveBeenCalledWith(
      '/print/trailers/in-drop',
      '_blank',
      'toolbar=yes,scrollbars=yes,menubar=yes'
    )
  })

  it('toggles status with the legacy confirmation message', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trailersService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(trailersService.toggleStatus).toHaveBeenCalledWith(1))
    expect(window.confirm).toHaveBeenCalledWith('Are you sure to deactivate this item?')
  })

  it('loads and saves trailer report fields', async () => {
    render(<MemoryRouter><TrailersPage /></MemoryRouter>)
    await screen.findByText('TRL-100')

    fireEvent.click(screen.getByTitle('Setting Fields For Reports'))
    expect(await screen.findByText('Trailer Fields Check For Reports')).toBeInTheDocument()
    expect(usersService.getDisplayOptions).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(usersService.updateDisplayOptions).toHaveBeenCalledWith({ trailer: 'number,VIN' }))
  })
})
