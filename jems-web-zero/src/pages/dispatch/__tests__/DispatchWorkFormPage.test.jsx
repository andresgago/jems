import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DispatchWorkFormPage from '../DispatchWorkFormPage'

vi.mock('../../../services/dispatch', async () => {
  const actual = await vi.importActual('../../../services/dispatch')
  return {
    ...actual,
    dispatchWorkService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dispatchersService: {
      options: vi.fn(),
    },
  }
})

import { dispatchWorkService, dispatchersService } from '../../../services/dispatch'

const DISPATCHERS = [
  { id: 10, full_name: 'Lilian Hernandez', dispatcher_type: 1, color: '#00ffff' },
  { id: 11, full_name: 'Pedro Cancino', dispatcher_type: 1, color: '#1c4587' },
]

beforeEach(() => {
  vi.clearAllMocks()
  dispatchersService.options.mockResolvedValue({ data: DISPATCHERS })
})

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/dispatch/work/create']}>
      <Routes>
        <Route path="/dispatch/work/create" element={<DispatchWorkFormPage />} />
        <Route path="/dispatch/calendar" element={<div>Calendar</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id = '1') {
  dispatchWorkService.get.mockResolvedValue({
    data: {
      id: Number(id),
      title: 'Existing Session',
      dispatcher: 10,
      start: '2024-01-15T08:00:00Z',
      end: '2024-01-15T16:00:00Z',
      session: '',
      invoice_percent: null,
      invoice_hour: null,
    },
  })
  return render(
    <MemoryRouter initialEntries={[`/dispatch/work/${id}/edit`]}>
      <Routes>
        <Route path="/dispatch/work/:id/edit" element={<DispatchWorkFormPage />} />
        <Route path="/dispatch/calendar" element={<div>Calendar</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DispatchWorkFormPage — create', () => {
  it('renders the create heading', async () => {
    renderCreate()
    expect(await screen.findByText('New Work Session')).toBeInTheDocument()
  })

  it('renders dispatcher options in the select', async () => {
    renderCreate()
    expect(await screen.findByText('Lilian Hernandez')).toBeInTheDocument()
    expect(screen.getByText('Pedro Cancino')).toBeInTheDocument()
  })

  it('shows title required error when submitting without a title', async () => {
    renderCreate()
    await screen.findByText('New Work Session')
    fireEvent.submit(screen.getByRole('button', { name: 'Create Session' }).closest('form'))
    expect(await screen.findByText('Required.')).toBeInTheDocument()
  })

  it('calls create with correct payload on submit', async () => {
    dispatchWorkService.create.mockResolvedValue({ data: { id: 5 } })
    renderCreate()
    await screen.findByText('New Work Session')

    // Labels have no htmlFor — find inputs by type
    const textInputs = document.querySelectorAll('input[type="text"], input:not([type])')
    fireEvent.change(textInputs[0], { target: { value: 'Test Session' } })

    const dtInputs = document.querySelectorAll('input[type="datetime-local"]')
    fireEvent.change(dtInputs[0], { target: { value: '2024-01-15T08:00' } })
    fireEvent.change(dtInputs[1], { target: { value: '2024-01-15T16:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }))
    await waitFor(() => expect(dispatchWorkService.create).toHaveBeenCalled())
    const [payload] = dispatchWorkService.create.mock.calls[0]
    expect(payload.title).toBe('Test Session')
    expect(payload.dispatcher).toBeNull()
  })
})

describe('DispatchWorkFormPage — edit', () => {
  it('renders the edit heading and pre-populates fields', async () => {
    renderEdit()
    expect(await screen.findByText('Edit Work Session')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing Session')).toBeInTheDocument()
  })

  it('calls update on save', async () => {
    dispatchWorkService.update.mockResolvedValue({ data: {} })
    renderEdit()
    await screen.findByDisplayValue('Existing Session')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(dispatchWorkService.update).toHaveBeenCalledWith('1', expect.any(Object)))
  })
})
