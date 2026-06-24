import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CityFormPage from '../CityFormPage'

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(() => [
    { id: 44, name: 'Texas', abbreviation: 'TX' },
    { id: 34, name: 'North Carolina', abbreviation: 'NC' },
  ]),
}))

vi.mock('../../../services/cities', async () => {
  const actual = await vi.importActual('../../../services/cities')
  return {
    ...actual,
    citiesService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
})

import { citiesService } from '../../../services/cities'

// Matches labels that may contain child spans by searching textContent
function getInput(labelPattern) {
  const regex = typeof labelPattern === 'string' ? new RegExp(labelPattern, 'i') : labelPattern
  const label = screen.getByText(
    (_, el) => el?.tagName === 'LABEL' && regex.test(el.textContent),
    { selector: 'label' }
  )
  return label.parentElement.querySelector('input, select, textarea')
}

function renderForm(path = '/settings/cities/create') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/cities/create" element={<CityFormPage />} />
        <Route path="/settings/cities/:id/edit" element={<CityFormPage />} />
        <Route path="/settings/cities/:id" element={<div>City detail</div>} />
        <Route path="/settings/cities" element={<div>Cities list</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('CityFormPage (create)', () => {
  it('shows Create City heading', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: /Create City/i })).toBeInTheDocument()
  })

  it('requires name before submitting', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Create City/i }))
    await waitFor(() => expect(screen.getByText('Name is required.')).toBeInTheDocument())
    expect(citiesService.create).not.toHaveBeenCalled()
  })

  it('requires 5-digit zip before submitting', async () => {
    renderForm()
    fireEvent.change(getInput(/Name/), { target: { value: 'Houston' } })
    fireEvent.change(getInput(/Zip Code/), { target: { value: 'ABC' } })
    fireEvent.click(screen.getByRole('button', { name: /Create City/i }))
    await waitFor(() => expect(screen.getByText('Zip must be exactly 5 digits.')).toBeInTheDocument())
    expect(citiesService.create).not.toHaveBeenCalled()
  })

  it('requires state before submitting', async () => {
    renderForm()
    fireEvent.change(getInput(/Name/), { target: { value: 'Houston' } })
    fireEvent.change(getInput(/Zip Code/), { target: { value: '77001' } })
    fireEvent.click(screen.getByRole('button', { name: /Create City/i }))
    await waitFor(() => expect(screen.getByText('State is required.')).toBeInTheDocument())
    expect(citiesService.create).not.toHaveBeenCalled()
  })

  it('submits payload with state as Number and navigates on success', async () => {
    citiesService.create.mockResolvedValue({ data: { id: 9 } })
    renderForm()
    fireEvent.change(getInput(/Name/), { target: { value: 'Houston' } })
    fireEvent.change(getInput(/Zip Code/), { target: { value: '77001' } })
    fireEvent.change(getInput(/State/), { target: { value: '44' } })
    fireEvent.change(getInput(/Timezone/), { target: { value: 'America/Chicago' } })
    fireEvent.click(screen.getByRole('button', { name: /Create City/i }))
    await waitFor(() => expect(citiesService.create).toHaveBeenCalledTimes(1))
    const payload = citiesService.create.mock.calls[0][0]
    expect(payload.name).toBe('Houston')
    expect(payload.zip).toBe('77001')
    expect(payload.state).toBe(44)
    expect(payload.timezone).toBe('America/Chicago')
  })

  it('renders state options in the select', () => {
    renderForm()
    expect(screen.getByRole('option', { name: /Texas/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /North Carolina/ })).toBeInTheDocument()
  })
})

describe('CityFormPage (edit)', () => {
  beforeEach(() => {
    citiesService.get.mockResolvedValue({
      data: {
        id: 5,
        name: 'Charlotte',
        zip: '28201',
        state: 34,
        timezone: 'America/New_York',
        active: true,
      },
    })
  })

  it('shows Edit City heading', async () => {
    renderForm('/settings/cities/5/edit')
    expect(await screen.findByRole('heading', { name: /Edit City/i })).toBeInTheDocument()
  })

  it('pre-populates name and zip', async () => {
    renderForm('/settings/cities/5/edit')
    expect(await screen.findByDisplayValue('Charlotte')).toBeInTheDocument()
    expect(screen.getByDisplayValue('28201')).toBeInTheDocument()
  })

  it('pre-populates timezone', async () => {
    renderForm('/settings/cities/5/edit')
    expect(await screen.findByDisplayValue('America/New_York')).toBeInTheDocument()
  })

  it('calls update (PATCH) on submit', async () => {
    citiesService.update.mockResolvedValue({ data: { id: 5 } })
    renderForm('/settings/cities/5/edit')
    await screen.findByDisplayValue('Charlotte')
    fireEvent.change(getInput(/Name/), { target: { value: 'Charlotte Updated' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))
    await waitFor(() =>
      expect(citiesService.update).toHaveBeenCalledWith(
        '5',
        expect.objectContaining({ name: 'Charlotte Updated' })
      )
    )
  })
})
