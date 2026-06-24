import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SystemSettingsPage from '../SystemSettingsPage'

vi.mock('../../../services/users', () => ({
  usersService: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getDisplayOptions: vi.fn(),
    updateDisplayOptions: vi.fn(),
  },
}))

import { usersService } from '../../../services/users'

function getInput(labelPattern) {
  const regex = typeof labelPattern === 'string' ? new RegExp(labelPattern, 'i') : labelPattern
  const label = screen.getByText(
    (_, el) => el?.tagName === 'LABEL' && regex.test(el.textContent),
    { selector: 'label' }
  )
  return label.parentElement.querySelector('input')
}

beforeEach(() => {
  vi.clearAllMocks()
  usersService.getConfig.mockResolvedValue({
    data: {
      start_hours_work_dispatcher: '08:00',
      end_hours_work_dispatcher: '17:00',
      dispatcher_invoice_hour: 1000,
      dispatcher_invoice_percent: 1000,
      driver_invoice: 1000,
      owner_invoice: 1000,
    },
  })
  usersService.getDisplayOptions.mockResolvedValue({
    data: {
      truck: 'number,VIN',
      trailer: 'number,year',
      driver: 'name,phone',
    },
  })
})

describe('SystemSettingsPage', () => {
  it('loads config and display options', async () => {
    render(<SystemSettingsPage />)
    expect(await screen.findByDisplayValue('number,VIN')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('1000')).toHaveLength(4)
  })

  it('saves both settings records', async () => {
    usersService.updateConfig.mockResolvedValue({
      data: {
        start_hours_work_dispatcher: '08:00',
        end_hours_work_dispatcher: '17:00',
        dispatcher_invoice_hour: 1000,
        dispatcher_invoice_percent: 1000,
        driver_invoice: 1500,
        owner_invoice: 1000,
      },
    })
    usersService.updateDisplayOptions.mockResolvedValue({
      data: { truck: 'number,VIN', trailer: 'number,year', driver: 'name,phone' },
    })
    render(<SystemSettingsPage />)
    await screen.findByDisplayValue('number,VIN')
    fireEvent.change(getInput(/Driver Invoice/), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }))
    await waitFor(() => expect(usersService.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ driver_invoice: 1500 })
    ))
    expect(usersService.updateDisplayOptions).toHaveBeenCalled()
  })
})
