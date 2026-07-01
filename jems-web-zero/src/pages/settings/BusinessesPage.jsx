import { useEffect, useMemo, useState } from 'react'
import { businessesService, BUSINESS_STATUS } from '../../services/businesses'
import { citiesService } from '../../services/cities'
import { useAuth } from '../../contexts/useAuth'

const EMPTY_FORM = { name: '', address: '', city: '', status: '1' }

function statusBadge(status) {
  const current = BUSINESS_STATUS[status] || BUSINESS_STATUS[String(status)] || { label: 'Unknown', cls: 'secondary' }
  return <span className={`badge bg-${current.cls}`}>{current.label}</span>
}

function ratingText(value) {
  const rating = Number(value || 0)
  return rating ? `(${Math.round(rating)})` : '(Not rating yet)'
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          {children}
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </div>
  )
}

function BusinessForm({ initial, cities, saving, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    address: initial?.address || '',
    city: initial?.city ? String(initial.city) : '',
    status: initial?.status !== undefined ? String(initial.status) : '1',
  }))

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = (event) => {
    event.preventDefault()
    onSubmit({
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city ? Number(form.city) : null,
      status: Number(form.status),
    })
  }

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label form-label-sm" htmlFor="business-name">Name</label>
            <input
              id="business-name"
              className="form-control form-control-sm"
              maxLength={255}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="col-md-3">
            <label className="form-label form-label-sm" htmlFor="business-city">City</label>
            <select
              id="business-city"
              className="form-select form-select-sm"
              value={form.city}
              onChange={(event) => set('city', event.target.value)}
            >
              <option value="">-</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}{city.state_abbreviation ? `, ${city.state_abbreviation}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label form-label-sm" htmlFor="business-status">Status</label>
            <select
              id="business-status"
              className="form-select form-select-sm"
              value={form.status}
              onChange={(event) => set('status', event.target.value)}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label form-label-sm" htmlFor="business-address">Address</label>
            <textarea
              id="business-address"
              className="form-control form-control-sm"
              rows={2}
              maxLength={500}
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="modal-footer py-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>
          Close
        </button>
        <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
          Save
        </button>
      </div>
    </form>
  )
}

function BusinessView({ business, isAdmin, onEdit, onClose }) {
  return (
    <>
      <div className="modal-body">
        <table className="table table-sm detail-table mb-0">
          <tbody>
            <tr><th>Name</th><td>{business.name}</td></tr>
            <tr><th>Address</th><td>{business.address || '-'}</td></tr>
            <tr><th>City</th><td>{business.city_display || '-'}</td></tr>
            {isAdmin && <tr><th>Rating</th><td>{ratingText(business.rating)}</td></tr>}
            <tr><th>Status</th><td>{statusBadge(business.status)}</td></tr>
            <tr><th>Loads</th><td>{business.load_count || 0}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="modal-footer py-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
          Edit
        </button>
      </div>
    </>
  )
}

export default function BusinessesPage() {
  const auth = useAuth() || {}
  const user = auth.user
  const isAdmin = Boolean(user?.roles?.includes('root') || user?.roles?.includes('admin'))

  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ name: '', address: '', city: '', status: '' })
  const [cities, setCities] = useState([])
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    citiesService.list({ active: '1', page_size: 200 })
      .then(({ data }) => setCities(data.results || []))
      .catch(() => setCities([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    businessesService.list({ page, ...filters })
      .then(({ data }) => {
        setItems(data.results || [])
        setCount(data.count || 0)
      })
      .catch(() => {
        setItems([])
        setCount(0)
      })
      .finally(() => setLoading(false))
  }, [page, filters, refreshKey])

  const refresh = () => setRefreshKey((current) => current + 1)

  const totalPages = Math.max(1, Math.ceil(count / 20))
  const showingFrom = count === 0 ? 0 : (page - 1) * 20 + 1
  const showingTo = Math.min(page * 20, count)

  const setFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(1)
  }

  const closeModal = () => {
    setModal(null)
    setFormError('')
  }

  const submitForm = async (payload) => {
    setSaving(true)
    setFormError('')
    try {
      if (modal?.mode === 'edit') {
        await businessesService.update(modal.item.id, payload)
      } else {
        await businessesService.create(payload)
      }
      closeModal()
      refresh()
    } catch (error) {
      const data = error.response?.data
      setFormError(data?.error?.join?.(' ') || data?.name?.join?.(' ') || 'Could not save business.')
    } finally {
      setSaving(false)
    }
  }

  const openView = async (business) => {
    const { data } = await businessesService.get(business.id)
    setModal({ mode: 'view', item: data })
  }

  const toggle = async (business) => {
    if (!window.confirm(`Toggle status for ${business.name}?`)) return
    await businessesService.toggleStatus(business.id)
    refresh()
  }

  const remove = async (business) => {
    if (!window.confirm(`Delete ${business.name}?`)) return
    try {
      await businessesService.destroy(business.id)
      refresh()
    } catch {
      alert('This business cannot be deleted because it is used by loads.')
    }
  }

  const cityOptions = useMemo(() => cities, [cities])

  return (
    <div className="legacy-grid-page">
      <div className="legacy-grid-title">
        <h5><i className="bi bi-list me-1" />Businesses</h5>
        <span>Showing {showingFrom}-{showingTo} of {count} items.</span>
      </div>

      <div className="legacy-grid-toolbar">
        <button className="btn btn-sm btn-primary" onClick={() => setModal({ mode: 'create', item: EMPTY_FORM })}>
          <i className="bi bi-plus-lg me-1" />New Business
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={refresh}>
          <i className="bi bi-arrow-clockwise" />
        </button>
      </div>

      <div className="legacy-grid-wrap">
        <table className="table table-sm table-hover mb-0 legacy-grid-table">
          <thead>
            <tr>
              <th className="select-col"><input type="checkbox" disabled aria-label="Select all" /></th>
              <th className="serial-col">#</th>
              <th>Name</th>
              <th>Address</th>
              <th>City</th>
              {isAdmin && <th>Rating</th>}
              <th>Status</th>
              <th className="text-center">Actions</th>
              <th className="text-center">Status</th>
            </tr>
            <tr className="legacy-filter-row">
              <th />
              <th />
              <th>
                <input className="form-control form-control-sm" placeholder="Find by name" value={filters.name} onChange={(event) => setFilter('name', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by address" value={filters.address} onChange={(event) => setFilter('address', event.target.value)} />
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.city} onChange={(event) => setFilter('city', event.target.value)}>
                  <option value="">Find by city</option>
                  {cityOptions.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}{city.state_abbreviation ? `, ${city.state_abbreviation}` : ''}</option>
                  ))}
                </select>
              </th>
              {isAdmin && <th />}
              <th>
                <select className="form-select form-select-sm" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                  <option value="">...</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </th>
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={isAdmin ? 9 : 8} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8} className="text-center text-muted py-4">No businesses found.</td></tr>}
            {!loading && items.map((business, index) => (
              <tr key={business.id} className={business.status !== 1 ? 'row-desactivada' : ''}>
                <td><input type="checkbox" aria-label={`Select ${business.name}`} /></td>
                <td>{(page - 1) * 20 + index + 1}</td>
                <td>{business.name}</td>
                <td>{business.address || '-'}</td>
                <td>{business.city_display || '-'}</td>
                {isAdmin && <td>{ratingText(business.rating)}</td>}
                <td>{statusBadge(business.status)}</td>
                <td className="text-center">
                  <button className="btn btn-link btn-sm p-0 me-2" title="View" onClick={() => openView(business)}><i className="bi bi-eye" /></button>
                  <button className="btn btn-link btn-sm p-0 me-2" title="Update" onClick={() => setModal({ mode: 'edit', item: business })}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-link btn-sm p-0 text-danger" title="Delete" onClick={() => remove(business)} disabled={!business.can_delete}><i className="bi bi-trash" /></button>
                </td>
                <td className="text-center">
                  <button className="btn btn-link btn-sm p-0" title="Toggle status" onClick={() => toggle(business)}>
                    <i className={`bi ${business.status === 1 ? 'bi-check-square text-success' : 'bi-square text-muted'}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legacy-grid-footer">
        <span><i className="bi bi-arrow-return-right me-1" />With selected</span>
        <button className="btn btn-xs btn-danger" disabled><i className="bi bi-trash me-1" />Delete All</button>
      </div>

      {totalPages > 1 && (
        <div className="legacy-pagination">
          <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Prev</button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, index) => index + 1).map((pageNumber) => (
            <button key={pageNumber} className={`btn btn-sm ${page === pageNumber ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setPage(pageNumber)}>
              {pageNumber}
            </button>
          ))}
          <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      )}

      {modal?.mode === 'view' && (
        <Modal title={`Business: ${modal.item.name}`} onClose={closeModal}>
          <BusinessView business={modal.item} isAdmin={isAdmin} onClose={closeModal} onEdit={() => setModal({ mode: 'edit', item: modal.item })} />
        </Modal>
      )}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'Create new Business' : `Update Business: ${modal.item.name}`} onClose={closeModal}>
          <BusinessForm initial={modal.item} cities={cities} saving={saving} error={formError} onSubmit={submitForm} onCancel={closeModal} />
        </Modal>
      )}
    </div>
  )
}
