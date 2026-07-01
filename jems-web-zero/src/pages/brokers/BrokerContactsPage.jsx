import { useEffect, useState } from 'react'
import { brokerContactsService } from '../../services/brokerContacts'
import { brokersService } from '../../services/brokers'

const EMPTY_FORM = { broker: '', name: '', email: '', phone: '', team: false, confirmed: false, is_scam: false }

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

function ContactForm({ initial, brokers, saving, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    broker: initial?.broker ? String(initial.broker) : '',
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    team: Boolean(initial?.team),
    confirmed: Boolean(initial?.confirmed),
    is_scam: Boolean(initial?.is_scam),
  }))

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = (event) => {
    event.preventDefault()
    onSubmit({
      broker: form.broker ? Number(form.broker) : null,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      team: form.team,
      confirmed: form.confirmed,
      is_scam: form.is_scam,
    })
  }

  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label form-label-sm" htmlFor="broker-contact-name">Name</label>
            <input
              id="broker-contact-name"
              className="form-control form-control-sm"
              maxLength={255}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="col-md-6">
            <label className="form-label form-label-sm" htmlFor="broker-contact-email">Email</label>
            <input
              id="broker-contact-email"
              className="form-control form-control-sm"
              type="email"
              maxLength={255}
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label form-label-sm" htmlFor="broker-contact-phone">Phone</label>
            <input
              id="broker-contact-phone"
              className="form-control form-control-sm"
              maxLength={255}
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
            />
          </div>
          <div className="col-md-8">
            <label className="form-label form-label-sm" htmlFor="broker-contact-broker">Broker</label>
            <select
              id="broker-contact-broker"
              className="form-select form-select-sm"
              value={form.broker}
              onChange={(event) => set('broker', event.target.value)}
              required
            >
              <option value="">...</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.label || broker.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <div className="form-check mt-4">
              <input id="contact-team" className="form-check-input" type="checkbox" checked={form.team} onChange={(event) => set('team', event.target.checked)} />
              <label className="form-check-label" htmlFor="contact-team">Team</label>
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-check mt-4">
              <input id="contact-confirmed" className="form-check-input" type="checkbox" checked={form.confirmed} onChange={(event) => set('confirmed', event.target.checked)} />
              <label className="form-check-label" htmlFor="contact-confirmed">Confirmed</label>
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-check mt-4">
              <input id="contact-scam" className="form-check-input" type="checkbox" checked={form.is_scam} onChange={(event) => set('is_scam', event.target.checked)} />
              <label className="form-check-label" htmlFor="contact-scam">Scam</label>
            </div>
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

function ContactView({ contact, onEdit, onClose }) {
  return (
    <>
      <div className="modal-body">
        <table className="table table-sm detail-table mb-0">
          <tbody>
            <tr><th>Name</th><td>{contact.name}</td></tr>
            <tr><th>Email</th><td><a href={`mailto:${contact.email}`}>{contact.email}</a></td></tr>
            <tr><th>Phone</th><td>{contact.phone || '-'}</td></tr>
            <tr><th>Broker</th><td>{contact.broker_name || '-'}</td></tr>
            <tr><th>Team</th><td>{contact.team ? 'Yes' : 'No'}</td></tr>
            <tr><th>Confirmed</th><td>{contact.confirmed ? 'Yes' : 'No'}</td></tr>
            <tr><th>Scam</th><td>{contact.is_scam ? 'Yes' : 'No'}</td></tr>
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

export default function BrokerContactsPage() {
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ name: '', email: '', phone: '', broker: '' })
  const [brokers, setBrokers] = useState([])
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    brokersService.options()
      .then(({ data }) => setBrokers(data || []))
      .catch(() => setBrokers([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    brokerContactsService.list({ page, ...filters })
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
        await brokerContactsService.update(modal.item.id, payload)
      } else {
        await brokerContactsService.create(payload)
      }
      closeModal()
      refresh()
    } catch (error) {
      const data = error.response?.data
      setFormError(data?.error?.join?.(' ') || data?.email?.join?.(' ') || data?.broker?.join?.(' ') || 'Could not save broker contact.')
    } finally {
      setSaving(false)
    }
  }

  const openView = async (contact) => {
    const { data } = await brokerContactsService.get(contact.id)
    setModal({ mode: 'view', item: data })
  }

  const remove = async (contact) => {
    if (!window.confirm(`Delete ${contact.name}?`)) return
    await brokerContactsService.destroy(contact.id)
    refresh()
  }

  return (
    <div className="legacy-grid-page">
      <div className="legacy-grid-title">
        <h5><i className="bi bi-list me-1" />Brokers contacts</h5>
        <span>Showing {showingFrom}-{showingTo} of {count} items.</span>
      </div>

      <div className="legacy-grid-toolbar">
        <button className="btn btn-sm btn-primary" onClick={() => setModal({ mode: 'create', item: EMPTY_FORM })}>
          <i className="bi bi-plus-lg me-1" />New Broker
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
              <th>Email</th>
              <th>Phone</th>
              <th>Broker</th>
              <th className="text-center">Team</th>
              <th className="text-center">Confirmed</th>
              <th className="text-center">Scam</th>
              <th className="text-center">Actions</th>
            </tr>
            <tr className="legacy-filter-row">
              <th />
              <th />
              <th>
                <input className="form-control form-control-sm" placeholder="Find by name" value={filters.name} onChange={(event) => setFilter('name', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by email" value={filters.email} onChange={(event) => setFilter('email', event.target.value)} />
              </th>
              <th>
                <input className="form-control form-control-sm" placeholder="Find by phone" value={filters.phone} onChange={(event) => setFilter('phone', event.target.value)} />
              </th>
              <th>
                <select className="form-select form-select-sm" value={filters.broker} onChange={(event) => setFilter('broker', event.target.value)}>
                  <option value="">...</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>{broker.label || broker.name}</option>
                  ))}
                </select>
              </th>
              <th />
              <th />
              <th />
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={10} className="text-center text-muted py-4">No broker contacts found.</td></tr>}
            {!loading && items.map((contact, index) => (
              <tr key={contact.id}>
                <td><input type="checkbox" aria-label={`Select ${contact.name}`} /></td>
                <td>{(page - 1) * 20 + index + 1}</td>
                <td>{contact.name}</td>
                <td><a href={`mailto:${contact.email}`}>{contact.email}</a></td>
                <td>{contact.phone || '-'}</td>
                <td>{contact.broker_name || '-'}</td>
                <td className="text-center">{contact.team ? <i className="bi bi-check-lg text-success" /> : '-'}</td>
                <td className="text-center">{contact.confirmed ? <i className="bi bi-check-lg text-success" /> : '-'}</td>
                <td className="text-center">{contact.is_scam ? <i className="bi bi-exclamation-triangle text-danger" /> : '-'}</td>
                <td className="text-center">
                  <button className="btn btn-link btn-sm p-0 me-2" title="View" onClick={() => openView(contact)}><i className="bi bi-eye" /></button>
                  <button className="btn btn-link btn-sm p-0 me-2" title="Update" onClick={() => setModal({ mode: 'edit', item: contact })}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-link btn-sm p-0 text-danger" title="Delete" onClick={() => remove(contact)}><i className="bi bi-trash" /></button>
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
        <Modal title={`Broker ${modal.item.name}`} onClose={closeModal}>
          <ContactView contact={modal.item} onClose={closeModal} onEdit={() => setModal({ mode: 'edit', item: modal.item })} />
        </Modal>
      )}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? 'Create new Broker' : `Update Broker ${modal.item.name}`} onClose={closeModal}>
          <ContactForm initial={modal.item} brokers={brokers} saving={saving} error={formError} onSubmit={submitForm} onCancel={closeModal} />
        </Modal>
      )}
    </div>
  )
}
