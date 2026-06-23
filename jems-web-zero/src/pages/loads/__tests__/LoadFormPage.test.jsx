import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoadFormPage from '../LoadFormPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../hooks/useOptions', () => ({
  useOptions: vi.fn(),
}))

vi.mock('../../../services/loads', () => ({
  loadsService: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../../../services/googleMaps', () => ({
  loadGoogleMaps: vi.fn(),
  parsePlaceComponents: vi.fn(),
  calculateMiles: vi.fn(),
}))

import { useOptions } from '../../../hooks/useOptions'
import { loadsService } from '../../../services/loads'
import api from '../../../services/api'
import { loadGoogleMaps, parsePlaceComponents, calculateMiles } from '../../../services/googleMaps'

const TRAILER_TYPES = [
  { id: 1, name: 'Van', short_name: 'V', is_active: true },
  { id: 2, name: 'Reefer', short_name: 'R', is_active: true },
]

const CARRIERS = [
  { id: 1, name: 'Jobee Express LLC' },
  { id: 2, name: 'Best Wheels Transport LLC' },
]

function renderNewForm() {
  return render(
    <MemoryRouter initialEntries={['/loads/new']}>
      <Routes>
        <Route path="/loads/new" element={<LoadFormPage />} />
        <Route path="/loads" element={<div>Loads list</div>} />
        <Route path="/loads/:id" element={<div>Load detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEditForm(id = '42') {
  return render(
    <MemoryRouter initialEntries={[`/loads/${id}/edit`]}>
      <Routes>
        <Route path="/loads/:id/edit" element={<LoadFormPage />} />
        <Route path="/loads/:id" element={<div>Load detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// Labels in this component use Bootstrap classes but no htmlFor.
// Find inputs by container (closest section) or by unique display value.
const getWeightInput = () => screen.getByDisplayValue('42000')
const getTrailerTypeSelect = () =>
  screen.getByRole('option', { name: /van \(v\)/i }).closest('select')

// ── New load ──────────────────────────────────────────────────────────────────

describe('LoadFormPage — new load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOptions.mockImplementation((url) => {
      if (url.includes('trailer-types')) return TRAILER_TYPES
      if (url.includes('carriers')) return CARRIERS
      return []
    })
    loadGoogleMaps.mockReturnValue(new Promise(() => {}))
  })

  it('renders the new load heading', () => {
    renderNewForm()
    expect(screen.getByText('New Load')).toBeInTheDocument()
  })

  // Weight ───────────────────────────────────────────────────────────────────

  it('weight field defaults to 42000', () => {
    renderNewForm()
    expect(getWeightInput()).toHaveValue(42000)
  })

  it('weight field is required', () => {
    renderNewForm()
    expect(getWeightInput()).toBeRequired()
  })

  it('weight label shows required asterisk', () => {
    renderNewForm()
    // The label contains "Weight (lbs)" text node + <span>*</span>
    const label = screen.getByText(/weight \(lbs\)/i, { selector: 'label' })
    expect(label).toHaveTextContent('*')
  })

  // Trailer Type ─────────────────────────────────────────────────────────────

  it('trailer type select is required', () => {
    renderNewForm()
    expect(getTrailerTypeSelect()).toBeRequired()
  })

  it('trailer type label shows required asterisk', () => {
    renderNewForm()
    const label = screen.getByText(/trailer type/i, { selector: 'label' })
    expect(label).toHaveTextContent('*')
  })

  it('renders trailer types with short_name in parentheses', () => {
    renderNewForm()
    expect(screen.getByRole('option', { name: /van \(v\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /reefer \(r\)/i })).toBeInTheDocument()
  })

  it('trailer type starts with empty placeholder', () => {
    renderNewForm()
    expect(getTrailerTypeSelect().value).toBe('')
  })

  it('trailer type shows all active options', () => {
    renderNewForm()
    const select = getTrailerTypeSelect()
    // placeholder + 2 active types
    expect(select.options).toHaveLength(3)
  })

  // Submit ───────────────────────────────────────────────────────────────────

  it('submit button is enabled initially', () => {
    renderNewForm()
    expect(screen.getByRole('button', { name: /create load/i })).toBeEnabled()
  })
})

// ── Edit load ─────────────────────────────────────────────────────────────────

describe('LoadFormPage — edit load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    loadGoogleMaps.mockReturnValue(new Promise(() => {}))
    useOptions.mockImplementation((url) => {
      if (url.includes('trailer-types')) return TRAILER_TYPES
      if (url.includes('carriers')) return CARRIERS
      return []
    })

    api.get.mockImplementation((url) => {
      if (url === '/brokers/1/contacts/') {
        return Promise.resolve({
          data: [
            { id: 10, name: 'John Doe', email: 'john@example.com', phone: '555-1000', team: 10 },
            { id: 11, name: 'Jane Doe', email: 'jane@example.com', phone: '555-1001', team: 10 },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })

    loadsService.get.mockResolvedValue({
      data: {
        number: 'ORD-001',
        weight: 44000,
        payment: '1500.00',
        detention: 0,
        lumper: 0,
        lumper_paid_by: '',
        drop_trailer: 0,
        miles: 500,
        miles_empty: 50,
        pickup_date: '2026-01-10',
        pickup_address: '123 Main St',
        pickup_city: 1,
        pickup_city_display: 'Denver, CO',
        dropoff_date: '2026-01-12',
        dropoff_address: '456 Oak Ave',
        dropoff_city: 2,
        dropoff_city_display: 'Chicago, IL',
        broker: 1,
        broker_name: 'Test Broker',
        broker_contacts: '10',
        trailer_type: 1,
        carrier: 1,
        carrier_name: 'Jobee Express LLC',
        shipper: null,
        receiver: null,
        details: 'Handle with care',
      },
    })
  })

  it('populates weight from existing load', async () => {
    renderEditForm()
    await waitFor(() =>
      expect(screen.getByDisplayValue('44000')).toBeInTheDocument()
    )
  })

  it('shows edit heading with load number', async () => {
    renderEditForm()
    await waitFor(() =>
      expect(screen.getByText(/edit load #ORD-001/i)).toBeInTheDocument()
    )
  })

  it('submit button shows Save Changes in edit mode', async () => {
    renderEditForm()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    )
  })

  it('loads real broker contacts for the selected broker', async () => {
    renderEditForm()

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/brokers/1/contacts/')
    )

    const john = await screen.findByRole('checkbox', { name: /john doe \(john@example.com\)/i })
    expect(john).toBeInTheDocument()
    expect(john).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /jane doe \(jane@example.com\)/i })).toBeInTheDocument()
  })

  it('allows selecting multiple existing broker contacts with normal clicks', async () => {
    renderEditForm()

    const jane = await screen.findByRole('checkbox', { name: /jane doe \(jane@example.com\)/i })
    fireEvent.click(jane)

    expect(screen.getByRole('checkbox', { name: /john doe \(john@example.com\)/i })).toBeChecked()
    expect(jane).toBeChecked()
  })

  it('creates a new broker contact inline and selects it', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        id: 12,
        name: 'New Contact',
        email: 'new@example.com',
        phone: '555-1002',
        team: null,
      },
    })

    renderEditForm()
    await screen.findByRole('checkbox', { name: /john doe/i })

    fireEvent.click(screen.getByTitle(/create new contact/i))
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Contact' },
    })
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Phone'), {
      target: { value: '555-1002' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add broker contact/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/brokers/1/contacts/', {
        name: 'New Contact',
        email: 'new@example.com',
        phone: '555-1002',
      })
    )
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledTimes(2)
    )

    const created = await screen.findByRole('checkbox', {
      name: /new contact \(new@example.com\)/i,
    })
    expect(created).toBeChecked()
  })

  it('add button stays disabled when phone is missing', async () => {
    renderEditForm()
    await screen.findByRole('checkbox', { name: /john doe/i })

    fireEvent.click(screen.getByTitle(/create new contact/i))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } })

    expect(screen.getByRole('button', { name: /add broker contact/i })).toBeDisabled()
  })

  it('scrolls to the newly created contact after adding', async () => {
    api.post.mockResolvedValueOnce({
      data: { id: 12, name: 'New Contact', email: 'new@example.com', phone: '', team: null },
    })

    renderEditForm()
    await screen.findByRole('checkbox', { name: /john doe/i })

    fireEvent.click(screen.getByTitle(/create new contact/i))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'New Contact' } })
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Phone'), { target: { value: '555-9999' } })
    fireEvent.click(screen.getByRole('button', { name: /add broker contact/i }))

    await screen.findByRole('checkbox', { name: /new contact \(new@example.com\)/i })

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
  })
})

// ── Address autocomplete ───────────────────────────────────────────────────────
//
// Each test sets up window.google with a fake Autocomplete constructor so we can
// capture instances and fire place_changed events manually.
//
// Regression guard: the StrictMode test would fail if the autocompleteReady.current
// guard (removed) were re-introduced, because it blocks the second (real) mount.

describe('LoadFormPage — address autocomplete', () => {
  let acInstances

  function setupGoogleMock() {
    acInstances = []
    window.google = {
      maps: {
        places: {
          // Must use `function`, not arrow, to be compatible as a `new` target
          Autocomplete: vi.fn(function(inputEl) {
            const listeners = {}
            const inst = {
              _input: inputEl,
              getPlace: vi.fn(() => ({
                geometry: { location: {} },
                address_components: [],
              })),
              addListener: vi.fn(function(event, cb) { listeners[event] = cb }),
              _fire: function() { listeners['place_changed']?.() },
            }
            acInstances.push(inst)
            return inst
          }),
        },
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useOptions.mockImplementation((url) => {
      if (url.includes('trailer-types')) return TRAILER_TYPES
      if (url.includes('carriers')) return CARRIERS
      return []
    })
    setupGoogleMock()
    loadGoogleMaps.mockResolvedValue(undefined)
    parsePlaceComponents.mockReturnValue({ street: '', zip: '', cityName: '', state: '' })
    calculateMiles.mockResolvedValue(null)
    api.get.mockResolvedValue({ data: [] })
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    delete window.google
  })

  // Regression: the removed autocompleteReady.current guard would cause this to fail
  // because StrictMode's cleanup sets cancelled=true on mount-1, and mount-2 would
  // see autocompleteReady=true and return early — resulting in 0 Autocomplete calls.
  it('initializes autocomplete on both inputs even under StrictMode', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/loads/new']}>
          <Routes>
            <Route path="/loads/new" element={<LoadFormPage />} />
            <Route path="/loads" element={<div>list</div>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    )
    await waitFor(() =>
      expect(window.google.maps.places.Autocomplete).toHaveBeenCalledTimes(2)
    )
  })

  it('fills pickup address when a place is selected', async () => {
    parsePlaceComponents.mockReturnValue({
      street: '123 Main St', zip: '10001', cityName: 'New York', state: 'NY',
    })
    api.get.mockResolvedValue({ data: [{ id: 5, name: 'New York', state: 'NY' }] })

    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))

    act(() => acInstances[0]._fire()) // pickup is always index 0

    await waitFor(() =>
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
    )
  })

  it('fills dropoff address when a place is selected', async () => {
    parsePlaceComponents.mockReturnValue({
      street: '456 Oak Ave', zip: '60601', cityName: 'Chicago', state: 'IL',
    })
    api.get.mockResolvedValue({ data: [{ id: 8, name: 'Chicago', state: 'IL' }] })

    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))

    act(() => acInstances[1]._fire()) // dropoff is always index 1

    await waitFor(() =>
      expect(screen.getByDisplayValue('456 Oak Ave')).toBeInTheDocument()
    )
  })

  it('calls calculateMiles after both pickup and dropoff places are selected', async () => {
    calculateMiles.mockResolvedValue(350)
    parsePlaceComponents
      .mockReturnValueOnce({ street: '123 Main St', zip: '10001', cityName: 'New York', state: 'NY' })
      .mockReturnValueOnce({ street: '456 Oak Ave', zip: '90210', cityName: 'Beverly Hills', state: 'CA' })

    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))

    act(() => acInstances[0]._fire()) // pickup — sets pickupLatLng; dropoffLatLng is null, no miles yet
    await waitFor(() => expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument())

    act(() => acInstances[1]._fire()) // dropoff — both latlng refs now set, miles are calculated
    await waitFor(() => expect(calculateMiles).toHaveBeenCalledTimes(1))
  })
})
