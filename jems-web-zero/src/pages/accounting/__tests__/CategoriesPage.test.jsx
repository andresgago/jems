import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CategoriesPage from '../CategoriesPage'

vi.mock('../../../services/accounting', async () => {
  const actual = await vi.importActual('../../../services/accounting')
  return {
    ...actual,
    categoriesService: {
      list: vi.fn(),
      toggleStatus: vi.fn(),
      destroy: vi.fn(),
      bulkDelete: vi.fn(),
    },
  }
})

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    defaults: { baseURL: 'http://localhost:8000/api/v1' },
  },
}))

import { categoriesService } from '../../../services/accounting'
import api from '../../../services/api'

const CAT_TYPES = [
  { id: 1, name: 'Oils', unit_of_measure: 'Gallons', is_active: true },
  { id: 2, name: 'Parts and Pieces', unit_of_measure: 'Unit', is_active: true },
]

const CATEGORIES = [
  {
    id: 1,
    code: 'OIL001',
    name: 'Oil Change',
    category_type: 1,
    category_type_name: 'Oils',
    unit_of_measure: 'Gallons',
    is_active: true,
    is_truck_part: false,
    photo: null,
  },
  {
    id: 2,
    code: 'BRK002',
    name: 'Brake Shoe',
    category_type: 2,
    category_type_name: 'Parts and Pieces',
    unit_of_measure: 'Unit',
    is_active: false,
    is_truck_part: true,
    photo: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  categoriesService.list.mockResolvedValue({ data: CATEGORIES })
  api.get.mockResolvedValue({ data: CAT_TYPES })
})

function renderPage() {
  return render(<MemoryRouter><CategoriesPage /></MemoryRouter>)
}

describe('CategoriesPage', () => {
  it('renders the Categories heading', async () => {
    renderPage()
    expect(await screen.findByText('Categories')).toBeInTheDocument()
  })

  it('shows category rows after loading', async () => {
    renderPage()
    expect(await screen.findByText('OIL001')).toBeInTheDocument()
    expect(screen.getByText('Oil Change')).toBeInTheDocument()
    expect(screen.getByText('BRK002')).toBeInTheDocument()
  })

  it('shows unit_of_measure column', async () => {
    renderPage()
    expect(await screen.findByText('Gallons')).toBeInTheDocument()
  })

  it('shows Truck Part badge for truck parts', async () => {
    renderPage()
    await screen.findByText('BRK002')
    const yesBadges = screen.getAllByText('Yes')
    expect(yesBadges.length).toBeGreaterThan(0)
  })

  it('inactive rows are dimmed (opacity 0.55)', async () => {
    renderPage()
    await screen.findByText('BRK002')
    // Inactive category should have a row with reduced opacity
    const cell = screen.getByText('BRK002').closest('tr')
    expect(cell).toHaveStyle({ opacity: '0.55' })
  })

  it('shows item count', async () => {
    renderPage()
    expect(await screen.findByText(/2 items/)).toBeInTheDocument()
  })

  it('shows New Category link', async () => {
    renderPage()
    await screen.findByText('OIL001')
    expect(screen.getByRole('link', { name: /New Category/i })).toBeInTheDocument()
  })

  it('filters by code input', async () => {
    renderPage()
    await screen.findByText('OIL001')
    const [codeInput] = screen.getAllByPlaceholderText('Code')
    fireEvent.change(codeInput, { target: { value: 'OIL' } })
    await waitFor(() => {
      expect(screen.getByText('OIL001')).toBeInTheDocument()
      expect(screen.queryByText('BRK002')).not.toBeInTheDocument()
    })
  })

  it('filters by name input', async () => {
    renderPage()
    await screen.findByText('OIL001')
    const [nameInput] = screen.getAllByPlaceholderText('Name')
    fireEvent.change(nameInput, { target: { value: 'brake' } })
    await waitFor(() => {
      expect(screen.getByText('BRK002')).toBeInTheDocument()
      expect(screen.queryByText('OIL001')).not.toBeInTheDocument()
    })
  })

  it('filters by truck part dropdown', async () => {
    renderPage()
    await screen.findByText('BRK002')
    // Find the truck part select specifically (has "All", "Yes", "Not" options)
    const truckPartSelects = screen.getAllByRole('combobox')
    const truckPartSelect = truckPartSelects.find((s) =>
      [...s.options].some((o) => o.text === 'Not')
    )
    fireEvent.change(truckPartSelect, { target: { value: '1' } })
    await waitFor(() => {
      expect(screen.getByText('BRK002')).toBeInTheDocument()
      expect(screen.queryByText('OIL001')).not.toBeInTheDocument()
    })
  })

  it('calls toggleStatus on status toggle click', async () => {
    categoriesService.toggleStatus.mockResolvedValue({ data: { ...CATEGORIES[0], is_active: false } })
    renderPage()
    await screen.findByText('OIL001')
    const toggleButtons = screen.getAllByTitle(/Active — click to deactivate/i)
    expect(toggleButtons.length).toBeGreaterThan(0)
    fireEvent.click(toggleButtons[0])
    await waitFor(() => {
      expect(categoriesService.toggleStatus).toHaveBeenCalledWith(CATEGORIES[0].id)
    })
  })

  it('calls destroy after delete confirm', async () => {
    window.confirm = vi.fn(() => true)
    categoriesService.destroy.mockResolvedValue({})
    renderPage()
    await screen.findByText('OIL001')
    const deleteButtons = screen.getAllByTitle('Delete')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(categoriesService.destroy).toHaveBeenCalledWith(CATEGORIES[0].id)
    })
  })

  it('does not call destroy when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false)
    renderPage()
    await screen.findByText('OIL001')
    const deleteButtons = screen.getAllByTitle('Delete')
    fireEvent.click(deleteButtons[0])
    expect(categoriesService.destroy).not.toHaveBeenCalled()
  })

  it('selects all when header checkbox clicked', async () => {
    renderPage()
    await screen.findByText('OIL001')
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox is "select all"
    fireEvent.click(checkboxes[0])
    await waitFor(() => {
      const rowCheckboxes = checkboxes.slice(1)
      rowCheckboxes.forEach((cb) => expect(cb).toBeChecked())
    })
  })

  it('bulk delete calls service with selected ids', async () => {
    window.confirm = vi.fn(() => true)
    categoriesService.bulkDelete.mockResolvedValue({ data: { deleted: [1], blocked: [] } })
    renderPage()
    await screen.findByText('OIL001')
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]) // select first row
    const deleteAllBtn = screen.getByRole('button', { name: /Delete All/i })
    fireEvent.click(deleteAllBtn)
    await waitFor(() => {
      expect(categoriesService.bulkDelete).toHaveBeenCalledWith([1])
    })
  })

  it('shows empty state when no results match filter', async () => {
    renderPage()
    await screen.findByText('OIL001')
    const [codeInput] = screen.getAllByPlaceholderText('Code')
    fireEvent.change(codeInput, { target: { value: 'ZZZNOMATCH' } })
    expect(screen.getByText('No categories found.')).toBeInTheDocument()
  })

  it('Reset button clears filters', async () => {
    renderPage()
    await screen.findByText('OIL001')
    const [codeInput] = screen.getAllByPlaceholderText('Code')
    fireEvent.change(codeInput, { target: { value: 'OIL' } })
    const resetBtn = screen.getByRole('button', { name: /Reset/i })
    fireEvent.click(resetBtn)
    await waitFor(() => {
      expect(codeInput.value).toBe('')
    })
    expect(screen.getByText('BRK002')).toBeInTheDocument()
  })
})
