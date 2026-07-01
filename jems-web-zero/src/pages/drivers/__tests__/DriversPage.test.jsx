import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DriversPage from '../DriversPage'

vi.mock('../../../services/drivers', async () => {
  const actual = await vi.importActual('../../../services/drivers')
  return {
    ...actual,
    driversService: { list: vi.fn(), toggleStatus: vi.fn(), destroy: vi.fn(), bulkDelete: vi.fn() },
  }
})

vi.mock('../../../services/users', () => ({
  usersService: { getDisplayOptions: vi.fn(), updateDisplayOptions: vi.fn() },
}))

import { driversService } from '../../../services/drivers'
import { usersService } from '../../../services/users'

const drivers = [
  { id: 1, full_name: 'John Doe', driver_type_name: 'Company', phone: '111', email: 'j@x.com', status: 1, license_expiration: '2020-01-01', medical_card_expiration: '2030-01-01', fuel_card_number: '5893', carrier_name: 'Jobee Express LLC', has_license_document: true, photo: null },
  { id: 2, full_name: 'Jane Roe', driver_type_name: 'Owner', phone: '222', email: 'r@x.com', status: 0, license_expiration: '2030-01-01', medical_card_expiration: '2030-01-01', fuel_card_number: '004', carrier_name: 'Best Wheels Transport LLC', has_license_document: false, photo: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  driversService.list.mockResolvedValue({ data: drivers })
  usersService.getDisplayOptions.mockResolvedValue({ data: { driver: 'name,lastname,phone,licensenumber,licensestate,birth' } })
  usersService.updateDisplayOptions.mockResolvedValue({ data: { driver: 'name,phone' } })
})

describe('DriversPage', () => {
  it('lists drivers returned by the service', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Roe')).toBeInTheDocument()
    expect(screen.getByText('Card fuel')).toBeInTheDocument()
    expect(screen.getAllByText('Jobee Express LLC').length).toBeGreaterThan(0)
  })

  it('filters by name search (client-side)', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.change(screen.getByPlaceholderText('Find by name'), { target: { value: 'jane' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Roe')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.change(screen.getByDisplayValue('...'), { target: { value: '0' } })
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Roe')).toBeInTheDocument()
  })

  it('toggles status and refreshes', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driversService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(driversService.toggleStatus).toHaveBeenCalledWith(1))
  })

  it('bulk deletes selected drivers', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    driversService.bulkDelete.mockResolvedValue({ data: {} })
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByLabelText('Select John Doe'))
    fireEvent.click(screen.getByText('Delete All'))
    await waitFor(() => expect(driversService.bulkDelete).toHaveBeenCalledWith([1]))
  })

  it('requires selected drivers before opening the drivers report', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByRole('button', { name: /Drivers Report/i }))
    expect(alertSpy).toHaveBeenCalledWith('Please select some drivers to show')
    expect(openSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
    openSpy.mockRestore()
  })

  it('opens the drivers report with selected driver ids', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByLabelText('Select John Doe'))
    fireEvent.click(screen.getByRole('button', { name: /Drivers Report/i }))
    expect(openSpy).toHaveBeenCalledWith('/print/drivers?ids=1', '_blank', 'toolbar=yes,scrollbars=yes,menubar=yes')
    openSpy.mockRestore()
  })

  it('requires selected drivers before opening the drivers export', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByTitle('Drivers Export'))
    expect(alertSpy).toHaveBeenCalledWith('Please select some drivers to show')
    expect(openSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
    openSpy.mockRestore()
  })

  it('opens the drivers export with selected driver ids', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByLabelText('Select John Doe'))
    fireEvent.click(screen.getByTitle('Drivers Export'))
    expect(openSpy).toHaveBeenCalledWith('/print/drivers/export?ids=1', '_blank', 'toolbar=yes,scrollbars=yes,menubar=yes')
    openSpy.mockRestore()
  })

  it('loads and saves driver report field settings', async () => {
    render(<MemoryRouter><DriversPage /></MemoryRouter>)
    await screen.findByText('John Doe')
    fireEvent.click(screen.getByTitle('Setting Fields For Reports'))
    expect(await screen.findByText('Driver Fields Check For Reports')).toBeInTheDocument()
    expect(screen.getByLabelText('Report field First Name')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Report field Phone'))
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    await waitFor(() => expect(usersService.updateDisplayOptions).toHaveBeenCalledWith({
      driver: 'name,lastname,licensenumber,licensestate,birth',
    }))
  })
})
