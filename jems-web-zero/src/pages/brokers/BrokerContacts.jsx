import { useState } from 'react'
import { brokersService } from '../../services/brokers'

function ContactRow({ contact, brokerId, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: contact.name, phone: contact.phone || '' })

  const save = async () => {
    await brokersService.updateContact(brokerId, contact.id, form)
    setEditing(false)
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm(`Delete contact ${contact.name}?`)) return
    await brokersService.deleteContact(brokerId, contact.id)
    onChanged()
  }

  if (editing) {
    return (
      <tr>
        <td>
          <input
            className="form-control form-control-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </td>
        <td>{contact.email}</td>
        <td>
          <input
            className="form-control form-control-sm"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </td>
        <td>{contact.team ? <span className="badge bg-info">Team</span> : null}</td>
        <td>{contact.confirmed ? <span className="badge bg-success">Confirmed</span> : null}</td>
        <td>{contact.is_scam ? <span className="badge bg-danger">Scam</span> : null}</td>
        <td className="text-end">
          <button className="btn btn-sm btn-primary me-1" onClick={save}>
            Save
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{contact.name}</td>
      <td>{contact.email}</td>
      <td>{contact.phone}</td>
      <td>{contact.team ? <span className="badge bg-info">Team</span> : null}</td>
      <td>{contact.confirmed ? <span className="badge bg-success">Confirmed</span> : null}</td>
      <td>{contact.is_scam ? <span className="badge bg-danger">Scam</span> : null}</td>
      <td className="text-end">
        <button
          className="btn btn-sm btn-outline-secondary me-1"
          onClick={() => setEditing(true)}
          title="Edit"
        >
          <i className="bi bi-pencil" />
        </button>
        <button className="btn btn-sm btn-outline-danger" onClick={remove} title="Delete">
          <i className="bi bi-trash" />
        </button>
      </td>
    </tr>
  )
}

function AddContactForm({ brokerId, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await brokersService.createContact(brokerId, form)
      setForm({ name: '', email: '', phone: '' })
      onAdded()
    } catch {
      setError('Failed to add contact. Check for duplicate email.')
    }
  }

  return (
    <form onSubmit={submit} className="d-flex gap-2 mt-2">
      <input
        className="form-control form-control-sm"
        placeholder="Name *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        className="form-control form-control-sm"
        placeholder="Email *"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        className="form-control form-control-sm"
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <button type="submit" className="btn btn-sm btn-primary text-nowrap">
        Add Contact
      </button>
      {error && <span className="text-danger small align-self-center">{error}</span>}
    </form>
  )
}

export default function BrokerContacts({ brokerId, contacts, onChanged }) {
  return (
    <div>
      <table className="table table-sm table-hover align-middle">
        <thead className="table-light">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Team</th>
            <th>Confirmed</th>
            <th>Scam</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {contacts.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-muted">
                No contacts yet.
              </td>
            </tr>
          ) : (
            contacts.map((c) => (
              <ContactRow key={c.id} contact={c} brokerId={brokerId} onChanged={onChanged} />
            ))
          )}
        </tbody>
      </table>
      <AddContactForm brokerId={brokerId} onAdded={onChanged} />
    </div>
  )
}
