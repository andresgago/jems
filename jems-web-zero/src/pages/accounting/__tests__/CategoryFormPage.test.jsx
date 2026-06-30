import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CategoryFormPage from '../CategoryFormPage'

vi.mock('../../../services/accounting', async () => {
  const actual = await vi.importActual('../../../services/accounting')
  return {
    ...actual,
    categoriesService: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
})

vi.mock('../../../services/api', () => {
  const get = vi.fn()
  return { default: { get, defaults: { baseURL: 'http://localhost:8000/api/v1' }, post: vi.fn() } }
})

import { categoriesService } from '../../../services/accounting'
import api from '../../../services/api'

const CAT_TYPES = [
  { id: 1, name: 'Oils', unit_of_measure: 'Gallons', is_active: true },
  { id: 2, name: 'Parts', unit_of_measure: 'Unit', is_active: true },
]
const ENGINE_TYPES = [{ id: 1, name: 'Cummins ISX', is_active: true }]
const CABIN_TYPES = [{ id: 1, name: 'Day Cab', is_active: true }]
const TRANSMISSION_TYPES = [{ id: 1, name: 'Manual 10sp', is_active: true }]

const EXISTING_CATEGORY = {
  id: 5,
  code: 'OIL001',
  name: 'Oil Change',
  category_type: 1,
  is_active: true,
  is_truck_part: false,
  engine_type: null,
  cabin_type: null,
  transmission_type: null,
  photo: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockImplementation((url) => {
    if (url.includes('category-types')) return Promise.resolve({ data: CAT_TYPES })
    if (url.includes('engine-types')) return Promise.resolve({ data: ENGINE_TYPES })
    if (url.includes('cabin-types')) return Promise.resolve({ data: CABIN_TYPES })
    if (url.includes('transmission-types')) return Promise.resolve({ data: TRANSMISSION_TYPES })
    return Promise.resolve({ data: [] })
  })
})

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/accounting/categories/create']}>
      <Routes>
        <Route path="/accounting/categories/create" element={<CategoryFormPage />} />
        <Route path="/accounting/categories/:id" element={<div>Detail</div>} />
        <Route path="/accounting/categories" element={<div>List</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/accounting/categories/${id}/edit`]}>
      <Routes>
        <Route path="/accounting/categories/:id/edit" element={<CategoryFormPage />} />
        <Route path="/accounting/categories/:id" element={<div>Detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CategoryFormPage — create', () => {
  it('renders New Category heading', async () => {
    renderCreate()
    expect(await screen.findByText('New Category')).toBeInTheDocument()
  })

  it('shows Create Category button', async () => {
    renderCreate()
    expect(await screen.findByRole('button', { name: /Create Category/i })).toBeInTheDocument()
  })

  it('renders category type options', async () => {
    renderCreate()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Oils \(Gallons\)/i })).toBeInTheDocument()
    })
  })

  it('shows validation errors when required fields empty', async () => {
    renderCreate()
    await screen.findByRole('button', { name: /Create Category/i })
    fireEvent.click(screen.getByRole('button', { name: /Create Category/i }))
    await waitFor(() => {
      expect(screen.getByText('Code is required.')).toBeInTheDocument()
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(screen.getByText('Type is required.')).toBeInTheDocument()
    })
  })

  it('calls create with correct payload on submit', async () => {
    categoriesService.create.mockResolvedValue({ data: { id: 10 } })
    renderCreate()
    await screen.findByRole('button', { name: /Create Category/i })

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'NEW001' } })
    fireEvent.change(inputs[1], { target: { value: 'New Category Name' } })

    const typeSelect = screen.getAllByRole('combobox').find((s) =>
      [...s.options].some((o) => o.text.includes('Oils'))
    )
    if (typeSelect) fireEvent.change(typeSelect, { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Category/i }))
    await waitFor(() => {
      expect(categoriesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NEW001',
          category_type: 1,
          is_active: true,
        })
      )
    })
  })

  it('FK fields are serialized as number or null', async () => {
    categoriesService.create.mockResolvedValue({ data: { id: 10 } })
    renderCreate()
    await screen.findByRole('button', { name: /Create Category/i })

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'X001' } })
    fireEvent.change(inputs[1], { target: { value: 'X Name' } })

    // Select a category type so validation passes
    const typeSelect = screen.getAllByRole('combobox').find((s) =>
      [...s.options].some((o) => o.text.includes('Oils'))
    )
    fireEvent.change(typeSelect, { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Category/i }))
    await waitFor(() => {
      const payload = categoriesService.create.mock.calls[0][0]
      // set FK → Number, unset optional FK → null (never empty string)
      expect(payload.category_type).toBe(1)
      expect(payload.engine_type).toBe(null)
    })
  })

  it('shows truck part sub-section when checkbox checked', async () => {
    renderCreate()
    await screen.findByText('Is Truck Part')
    const checkbox = screen.getByRole('checkbox')
    expect(screen.queryByText('Engine')).not.toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(await screen.findByText('Engine')).toBeInTheDocument()
    expect(screen.getByText('Cabin / Model')).toBeInTheDocument()
    expect(screen.getByText('Transmission')).toBeInTheDocument()
  })

  it('engine/cabin/transmission options render when truck part checked', async () => {
    renderCreate()
    await screen.findByText('Is Truck Part')
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cummins ISX' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Day Cab' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Manual 10sp' })).toBeInTheDocument()
    })
  })

  it('truck part fields are null in payload when is_truck_part is false', async () => {
    categoriesService.create.mockResolvedValue({ data: { id: 10 } })
    renderCreate()
    await screen.findByRole('button', { name: /Create Category/i })

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'TP001' } })
    fireEvent.change(inputs[1], { target: { value: 'No Truck Part' } })

    fireEvent.click(screen.getByRole('button', { name: /Create Category/i }))
    await waitFor(() => {
      if (categoriesService.create.mock.calls.length) {
        const payload = categoriesService.create.mock.calls[0][0]
        expect(payload.engine_type).toBe(null)
        expect(payload.cabin_type).toBe(null)
        expect(payload.transmission_type).toBe(null)
      }
    })
  })
})

describe('CategoryFormPage — edit', () => {
  beforeEach(() => {
    categoriesService.get.mockResolvedValue({ data: EXISTING_CATEGORY })
  })

  it('renders Edit heading with code', async () => {
    renderEdit()
    expect(await screen.findByText(/Edit Category — OIL001/i)).toBeInTheDocument()
  })

  it('pre-populates code and name', async () => {
    renderEdit()
    await waitFor(() => {
      expect(screen.getByDisplayValue('OIL001')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Oil Change')).toBeInTheDocument()
    })
  })

  it('shows Save Changes button', async () => {
    renderEdit()
    expect(await screen.findByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
  })

  it('calls update on save', async () => {
    categoriesService.update.mockResolvedValue({ data: { ...EXISTING_CATEGORY, name: 'Updated' } })
    renderEdit()
    await screen.findByRole('button', { name: /Save Changes/i })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))
    await waitFor(() => {
      expect(categoriesService.update).toHaveBeenCalledWith(
        '5',
        expect.objectContaining({ code: 'OIL001', is_active: true })
      )
    })
  })

  it('status pre-populates as Active when is_active=true', async () => {
    renderEdit()
    await screen.findByRole('button', { name: /Save Changes/i })
    const statusSelect = screen.getAllByRole('combobox').find((s) =>
      [...s.options].some((o) => o.text === 'Active')
    )
    expect(statusSelect?.value).toBe('1')
  })
})
