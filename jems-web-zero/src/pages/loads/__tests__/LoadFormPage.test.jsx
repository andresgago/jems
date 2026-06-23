import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoadFormPage from '../LoadFormPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('flatpickr', () => {
  const instance = { setDate: vi.fn(), clear: vi.fn(), destroy: vi.fn(), set: vi.fn() };
  const fp = vi.fn(() => instance);
  fp._instance = instance;
  return { default: fp };
})

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

import flatpickr from 'flatpickr'
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
const getDetentionInput = () =>
  screen.getByText(/detention \(\$\)/i, { selector: 'label' }).nextElementSibling
const getLumperInput = () =>
  screen.getByText(/lumper \(\$\)/i, { selector: 'label' }).nextElementSibling
const getDetailsInput = () =>
  screen.getByText(/^details/i, { selector: 'label' }).nextElementSibling

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

  // Dates ────────────────────────────────────────────────────────────────────

  it('Pickup Date label shows required asterisk', () => {
    renderNewForm()
    const label = screen.getByText(/pickup date/i, { selector: 'label' })
    expect(label).toHaveTextContent('*')
  })

  it('Dropoff Date label shows required asterisk', () => {
    renderNewForm()
    const label = screen.getByText(/dropoff date/i, { selector: 'label' })
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

  it('details defaults to the legacy note and is required', () => {
    renderNewForm()
    const details = getDetailsInput()
    expect(details).toHaveValue('Must be on time.')
    expect(details).toBeRequired()
    expect(details).toHaveAttribute('maxLength', '800')
  })

  it('sends detention amount in the create payload', async () => {
    loadsService.create.mockResolvedValueOnce({ data: { id: 123 } })

    renderNewForm()
    fireEvent.change(getDetentionInput(), { target: { value: '125.50' } })
    fireEvent.submit(screen.getByRole('button', { name: /create load/i }).closest('form'))

    await waitFor(() =>
      expect(loadsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ detention: 125.5 })
      )
    )
  })

  it('shows Lumper Paid By only when lumper is greater than zero', () => {
    renderNewForm()
    expect(screen.queryByText(/lumper paid by/i, { selector: 'label' })).not.toBeInTheDocument()

    fireEvent.change(getLumperInput(), { target: { value: '75' } })
    expect(screen.getByText(/lumper paid by/i, { selector: 'label' })).toBeInTheDocument()

    fireEvent.change(getLumperInput(), { target: { value: '0' } })
    expect(screen.queryByText(/lumper paid by/i, { selector: 'label' })).not.toBeInTheDocument()
  })

  it('clears Lumper Paid By when lumper returns to zero', async () => {
    loadsService.create.mockResolvedValueOnce({ data: { id: 123 } })

    renderNewForm()
    fireEvent.change(getLumperInput(), { target: { value: '75' } })
    fireEvent.change(screen.getByText(/lumper paid by/i, { selector: 'label' }).nextElementSibling, {
      target: { value: 'driver' },
    })
    fireEvent.change(getLumperInput(), { target: { value: '0' } })
    fireEvent.submit(screen.getByRole('button', { name: /create load/i }).closest('form'))

    await waitFor(() =>
      expect(loadsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ lumper: 0, lumper_paid_by: '' })
      )
    )
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
        miles: 500,
        miles_empty: 50,
        pickup_date: '2026-01-10T15:00:00Z',
        pickup_address: '123 Main St',
        pickup_city: 1,
        pickup_city_display: 'Denver, CO',
        dropoff_date: '2026-01-12T20:00:00Z',
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

  it('converts UTC ISO dates to ET "YYYY-MM-DD HH:MM" when populating the pickers', async () => {
    renderEditForm()
    // 2026-01-10T15:00:00Z = 2026-01-10 10:00 ET (UTC-5, EST)
    // 2026-01-12T20:00:00Z = 2026-01-12 15:00 ET (UTC-5, EST)
    await waitFor(() =>
      expect(flatpickr._instance.setDate).toHaveBeenCalledWith('2026-01-10 10:00', false)
    )
    expect(flatpickr._instance.setDate).toHaveBeenCalledWith('2026-01-12 15:00', false)
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

// ── Shipper / Receiver fields ─────────────────────────────────────────────────

describe('LoadFormPage — shipper and receiver fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOptions.mockImplementation((url) => {
      if (url.includes('trailer-types')) return TRAILER_TYPES
      if (url.includes('carriers')) return CARRIERS
      return []
    })
    loadGoogleMaps.mockReturnValue(new Promise(() => {}))
    api.get.mockResolvedValue({ data: [] })
  })

  it('Shipper label shows required asterisk', () => {
    renderNewForm()
    const label = screen.getByText(/shipper/i, { selector: 'label' })
    expect(label).toHaveTextContent('*')
  })

  it('Receiver label shows required asterisk', () => {
    renderNewForm()
    const label = screen.getByText(/receiver/i, { selector: 'label' })
    expect(label).toHaveTextContent('*')
  })

  it('Shipper label has a "+" button', () => {
    renderNewForm()
    const label = screen.getByText(/shipper/i, { selector: 'label' })
    expect(label.querySelector('button[title="New business"]')).toBeInTheDocument()
  })

  it('Receiver label has a "+" button', () => {
    renderNewForm()
    const label = screen.getByText(/receiver/i, { selector: 'label' })
    expect(label.querySelector('button[title="New business"]')).toBeInTheDocument()
  })

  it('clicking "+" on Shipper shows the inline create form', () => {
    renderNewForm()
    const label = screen.getByText(/shipper/i, { selector: 'label' })
    fireEvent.click(label.querySelector('button[title="New business"]'))
    expect(screen.getByPlaceholderText('Business name')).toBeInTheDocument()
  })

  it('clicking "+" on Receiver shows its own inline create form', () => {
    renderNewForm()
    const label = screen.getByText(/receiver/i, { selector: 'label' })
    fireEvent.click(label.querySelector('button[title="New business"]'))
    expect(screen.getByPlaceholderText('Business name')).toBeInTheDocument()
  })

  it('Cancel button hides the inline create form', () => {
    renderNewForm()
    const label = screen.getByText(/shipper/i, { selector: 'label' })
    fireEvent.click(label.querySelector('button[title="New business"]'))
    // Use within to avoid ambiguity with the main form's Cancel button
    const inlineForm = screen.getByPlaceholderText('Business name').closest('.border')
    fireEvent.click(within(inlineForm).getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText('Business name')).not.toBeInTheDocument()
  })

  it('creating a business via inline form auto-selects it as Shipper', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 77, name: 'New Warehouse LLC' } })

    renderNewForm()
    const label = screen.getByText(/shipper/i, { selector: 'label' })
    fireEvent.click(label.querySelector('button[title="New business"]'))

    fireEvent.change(screen.getByPlaceholderText('Business name'), {
      target: { value: 'New Warehouse LLC' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/brokers/business/', { name: 'New Warehouse LLC' })
    )
    await waitFor(() =>
      expect(screen.getByDisplayValue('New Warehouse LLC')).toBeInTheDocument()
    )
    expect(screen.queryByPlaceholderText('Business name')).not.toBeInTheDocument()
  })

  it('inline create form Save button is disabled when name is empty', () => {
    renderNewForm()
    const label = screen.getByText(/shipper/i, { selector: 'label' })
    fireEvent.click(label.querySelector('button[title="New business"]'))
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('searchBusiness passes city_display as sublabel to results', async () => {
    api.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'Acme Warehouse', city_display: 'Houston, TX' }],
    })

    renderNewForm()
    const shipperInput = screen.getByPlaceholderText('Type to search shipper...')
    fireEvent.change(shipperInput, { target: { value: 'Ac' } })

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/brokers/business/search/',
        expect.objectContaining({ params: { q: 'Ac' } })
      )
    )

    await waitFor(() =>
      expect(screen.getByText('Acme Warehouse')).toBeInTheDocument()
    )
    expect(screen.getByText('Houston, TX')).toBeInTheDocument()
  })

  it('shows server error under Shipper when API returns validation error', async () => {
    loadsService.create.mockRejectedValueOnce({
      response: { data: { shipper: ['This field is required.'] } },
    })

    renderNewForm()
    // Use fireEvent.submit on the form to bypass jsdom HTML5 constraint validation
    const form = screen.getByRole('button', { name: /create load/i }).closest('form')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(screen.getByText('This field is required.')).toBeInTheDocument()
    )
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
    await waitFor(() => expect(screen.getByDisplayValue('350')).toBeInTheDocument())
  })

  it('miles input is readonly', async () => {
    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))
    const milesLabel = screen.getByText('Miles', { selector: 'label' })
    const milesInput = milesLabel.nextElementSibling
    expect(milesInput).toHaveAttribute('readonly')
  })

  it('does not call calculateMiles when only one address is set', async () => {
    parsePlaceComponents.mockReturnValue({ street: '123 Main St', zip: '10001', cityName: 'New York', state: 'NY' })

    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))

    act(() => acInstances[0]._fire()) // pickup only — dropoffLatLng is null
    await waitFor(() => expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument())

    expect(calculateMiles).not.toHaveBeenCalled()
  })

  it('recalculates miles when pickup changes after dropoff is already set', async () => {
    calculateMiles.mockResolvedValue(350)
    parsePlaceComponents
      .mockReturnValueOnce({ street: '456 Oak Ave', zip: '90210', cityName: 'Beverly Hills', state: 'CA' })
      .mockReturnValueOnce({ street: '123 Main St', zip: '10001', cityName: 'New York', state: 'NY' })
      .mockReturnValueOnce({ street: '999 New St', zip: '10002', cityName: 'Brooklyn', state: 'NY' })

    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))

    act(() => acInstances[1]._fire()) // dropoff only — pickupLatLng is null, no calc
    await waitFor(() => expect(screen.getByDisplayValue('456 Oak Ave')).toBeInTheDocument())
    expect(calculateMiles).not.toHaveBeenCalled()

    act(() => acInstances[0]._fire()) // pickup set — both latlng refs now set, calc once
    await waitFor(() => expect(calculateMiles).toHaveBeenCalledTimes(1))

    act(() => acInstances[0]._fire()) // pickup changes again — recalculates
    await waitFor(() => expect(calculateMiles).toHaveBeenCalledTimes(2))
  })

  it('miles value is included in the submit payload', async () => {
    calculateMiles.mockResolvedValue(350)
    parsePlaceComponents
      .mockReturnValueOnce({ street: '123 Main St', zip: '10001', cityName: 'New York', state: 'NY' })
      .mockReturnValueOnce({ street: '456 Oak Ave', zip: '90210', cityName: 'Beverly Hills', state: 'CA' })
    loadsService.create.mockResolvedValue({ data: { id: 99 } })

    renderNewForm()
    await waitFor(() => expect(acInstances).toHaveLength(2))

    act(() => acInstances[0]._fire()) // pickup
    await waitFor(() => expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument())

    act(() => acInstances[1]._fire()) // dropoff — miles auto-calculated to 350
    await waitFor(() => expect(screen.getByDisplayValue('350')).toBeInTheDocument())

    const form = screen.getByRole('button', { name: /create load/i }).closest('form')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(loadsService.create).toHaveBeenCalledWith(expect.objectContaining({ miles: 350 }))
    )
  })
})
