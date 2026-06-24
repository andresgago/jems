import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UsersPage from '../UsersPage'

vi.mock('../../../hooks/useUsers', () => ({
  useUsers: vi.fn(() => ({
    loading: false,
    error: null,
    reload: vi.fn(),
    items: [
      {
        id: 1,
        username: 'lilian',
        first_name: 'Lilian',
        last_name: 'Hernandez',
        full_name: 'Lilian Hernandez',
        email: 'lilian@example.com',
        status: 10,
        is_dispatcher: true,
        dispatcher_type_display: 'Main',
        contract_display: 'By Percent',
      },
      {
        id: 2,
        username: 'mechanics',
        first_name: 'Kristian',
        last_name: 'Castro',
        full_name: 'Kristian Castro',
        email: 'repairs@example.com',
        status: 0,
        is_dispatcher: false,
        contract_display: 'By Hour',
      },
    ],
  })),
}))

vi.mock('../../../services/users', async () => {
  const actual = await vi.importActual('../../../services/users')
  return {
    ...actual,
    usersService: {
      toggleStatus: vi.fn(),
    },
  }
})

import { usersService } from '../../../services/users'

beforeEach(() => vi.clearAllMocks())

describe('UsersPage', () => {
  it('renders user rows', () => {
    render(<MemoryRouter><UsersPage /></MemoryRouter>)
    expect(screen.getByText('Lilian Hernandez')).toBeInTheDocument()
    expect(screen.getByText('Kristian Castro')).toBeInTheDocument()
  })

  it('filters by username', () => {
    render(<MemoryRouter><UsersPage /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/name, username, or email/i), { target: { value: 'mechanics' } })
    expect(screen.queryByText('Lilian Hernandez')).not.toBeInTheDocument()
    expect(screen.getByText('Kristian Castro')).toBeInTheDocument()
  })

  it('shows status badges', () => {
    render(<MemoryRouter><UsersPage /></MemoryRouter>)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('toggles status after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    usersService.toggleStatus.mockResolvedValue({ data: {} })
    render(<MemoryRouter><UsersPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByTitle('Toggle status')[0])
    await waitFor(() => expect(usersService.toggleStatus).toHaveBeenCalledWith(1))
    vi.restoreAllMocks()
  })
})
