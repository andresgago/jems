import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import UserFormPage from '../UserFormPage'
import { buildUserPayload } from '../userPayload'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn((path) => {
    if (path.includes('positions')) return [{ id: 3, name: 'Dispatcher' }]
    return [{ id: 10, label: 'Main Dispatcher' }]
  }),
}))

vi.mock('../../../services/users', async () => {
  const actual = await vi.importActual('../../../services/users')
  return {
    ...actual,
    usersService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
})

import { usersService } from '../../../services/users'

function getInput(labelPattern) {
  const regex = typeof labelPattern === 'string' ? new RegExp(labelPattern, 'i') : labelPattern
  const label = screen.getByText(
    (_, el) => el?.tagName === 'LABEL' && regex.test(el.textContent),
    { selector: 'label' }
  )
  return label.parentElement.querySelector('input, select, textarea')
}

function renderForm(path = '/settings/users/create') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/users/create" element={<UserFormPage />} />
        <Route path="/settings/users/:id/edit" element={<UserFormPage />} />
        <Route path="/settings/users/:id" element={<div>User detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('buildUserPayload', () => {
  it('serializes FK, time, and number fields', () => {
    const payload = buildUserPayload({
      position: '3',
      main_dispatcher: '',
      status: '10',
      dispatcher_type: '1',
      contract: '0',
      percent: '2.5',
      hours: '8',
      carrier: '1',
      start_hour: '',
      end_hour: '17:00',
      password: 'secret123',
    })

    expect(payload.position).toBe(3)
    expect(payload.main_dispatcher).toBeNull()
    expect(payload.percent).toBe(2.5)
    expect(payload.start_hour).toBeNull()
    expect(payload.end_hour).toBe('17:00')
  })
})

describe('UserFormPage', () => {
  it('requires username on create', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }))
    await waitFor(() => expect(screen.getByText('Username is required.')).toBeInTheDocument())
    expect(usersService.create).not.toHaveBeenCalled()
  })

  it('renders position and main dispatcher options', () => {
    renderForm()
    expect(screen.getByRole('option', { name: 'Dispatcher' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Main Dispatcher' })).toBeInTheDocument()
  })

  it('submits create payload', async () => {
    usersService.create.mockResolvedValue({ data: { id: 9 } })
    renderForm()
    fireEvent.change(getInput(/Username/), { target: { value: 'newuser' } })
    fireEvent.change(getInput(/First Name/), { target: { value: 'New' } })
    fireEvent.change(getInput(/Last Name/), { target: { value: 'User' } })
    fireEvent.change(getInput(/Email/), { target: { value: 'new@example.com' } })
    fireEvent.change(getInput(/Password/), { target: { value: 'secret123' } })
    fireEvent.change(getInput(/Position/), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }))
    await waitFor(() => expect(usersService.create).toHaveBeenCalledTimes(1))
    expect(usersService.create.mock.calls[0][0]).toEqual(expect.objectContaining({
      username: 'newuser',
      position: 3,
      status: 10,
    }))
  })

  it('pre-populates edit and calls PATCH service', async () => {
    usersService.get.mockResolvedValue({
      data: {
        id: 5,
        username: 'lilian',
        first_name: 'Lilian',
        last_name: 'Hernandez',
        email: 'lilian@example.com',
        status: 10,
        is_dispatcher: true,
        dispatcher_type: 0,
        contract: 0,
        percent: 2.5,
        hours: 0,
        carrier: 0,
      },
    })
    usersService.update.mockResolvedValue({ data: { id: 5 } })
    renderForm('/settings/users/5/edit')
    expect(await screen.findByDisplayValue('Lilian')).toBeInTheDocument()
    fireEvent.change(getInput(/First Name/), { target: { value: 'Lily' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))
    await waitFor(() => expect(usersService.update).toHaveBeenCalledWith(
      '5',
      expect.objectContaining({ first_name: 'Lily' })
    ))
  })
})
