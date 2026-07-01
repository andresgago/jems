import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TrucksPage from '../TrucksPage'

vi.mock('../../../services/trucks', async () => {
  const actual = await vi.importActual('../../../services/trucks')
  return { ...actual, trucksService: { list: vi.fn(), toggleStatus: vi.fn(), destroy: vi.fn() } }
})

vi.mock('../../../services/users', () => ({
  usersService: { getDisplayOptions: vi.fn(), updateDisplayOptions: vi.fn() },
}))

import { trucksService } from '../../../services/trucks'
import { usersService } from '../../../services/users'

const trucks = [
  {
    id: 1,
    number: 'T-100',
    truck_type_name: 'Sleeper',
    plate: 'ABC123',
    transponder: 'TRP1',
    vin: '1FUJ',
    year: 2022,
    status: 1,
    avi_file: '/media/trucks/avi/a.pdf',
    avi_expiration: '2020-01-01',
    registration_file: null,
    registration_expiration: '2030-01-01',
    carrier_name: 'Jobee Express',
    owner_name: 'Express Fleet',
  },
  {
    id: 2,
    number: 'T-200',
    truck_type_name: 'Day Cab',
    plate: 'XYZ789',
    transponder: 'TRP2',
    vin: '2GHK',
    year: 2023,
    status: 0,
    avi_file: null,
    avi_expiration: '2030-01-01',
    registration_file: null,
    registration_expiration: '2030-01-01',
    carrier_name: 'Best Wheels',
    owner_name: 'Jobee Express',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  trucksService.list.mockResolvedValue({ data: trucks })
  usersService.getDisplayOptions.mockResolvedValue({ data: { truck: 'number,VIN' } })
  usersService.updateDisplayOptions.mockResolvedValue({ data: { truck: 'number,VIN' } })
})

describe('TrucksPage', () => {
  it('lists active and inactive trucks returned by the service', async () => {
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    expect(await screen.findByText('T-100')).toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(1)
  })

  it('filters by number and carrier client-side', async () => {
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')
    fireEvent.change(screen.getByPlaceholderText('Find by number'), { target: { value: 't-200' } })
    expect(screen.queryByText('T-100')).not.toBeInTheDocument()
    expect(screen.getByText('T-200')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Find by number'), { target: { value: '' } })
    fireEvent.change(screen.getByDisplayValue('Filter by carrier'), { target: { value: 'Jobee Express' } })
    expect(screen.getByText('T-100')).toBeInTheDocument()
    expect(screen.queryByText('T-200')).not.toBeInTheDocument()
  })

  it('shows legacy owner, document, print and AVI action columns', async () => {
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')

    expect(screen.getByRole('row', { name: /T-100/ })).toHaveTextContent('Express Fleet')
    expect(screen.getByDisplayValue('Filter by owner operator')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /New AVI/i })).toHaveLength(2)
    expect(screen.getAllByTitle('View Truck')).toHaveLength(2)
    expect(screen.getByText('Showing 1-2 of 2 items.')).toBeInTheDocument()
  })

  it('shows the legacy empty-selection message for report and export', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')

    fireEvent.click(screen.getByRole('button', { name: /Trucks Report/i }))
    fireEvent.click(screen.getByTitle('Trucks Export'))

    expect(alert).toHaveBeenCalledWith('Please select some trucks to show')
    expect(alert).toHaveBeenCalledTimes(2)
  })

  it('opens report for selected trucks', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')

    fireEvent.click(screen.getByLabelText('Select truck T-100'))
    fireEvent.click(screen.getByRole('button', { name: /Trucks Report/i }))

    expect(open).toHaveBeenCalledWith(
      '/print/trucks?ids=1',
      '_blank',
      'toolbar=yes,scrollbars=yes,menubar=yes'
    )
  })

  it('toggles status with the legacy confirmation message', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    trucksService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(trucksService.toggleStatus).toHaveBeenCalledWith(1))
    expect(window.confirm).toHaveBeenCalledWith('Are you sure to deactivate this item?')
  })

  it('loads and saves truck report fields', async () => {
    render(<MemoryRouter><TrucksPage /></MemoryRouter>)
    await screen.findByText('T-100')

    fireEvent.click(screen.getByTitle('Setting Fields For Reports'))
    expect(await screen.findByText('Truck Fields Check For Reports')).toBeInTheDocument()
    expect(usersService.getDisplayOptions).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(usersService.updateDisplayOptions).toHaveBeenCalledWith({ truck: 'number,VIN' }))
  })
})
