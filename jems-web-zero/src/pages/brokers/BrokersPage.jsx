import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBrokers } from '../../hooks/useBrokers'
import { BROKER_STATUS, brokersService } from '../../services/brokers'

function StatusBadge({ status }) {
  const s = BROKER_STATUS[status] || { label: 'Unknown', cls: 'secondary' }
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>
}

export default function BrokersPage() {
  const { items, loading, reload } = useBrokers()
  const [filter, setFilter] = useState('')

  const visible = items.filter((b) => {
    const q = filter.toLowerCase()
    return (
      b.name.toLowerCase().includes(q) ||
      b.mc.toLowerCase().includes(q) ||
      (b.dba_name || '').toLowerCase().includes(q)
    )
  })

  const handleToggle = async (broker) => {
    const label = BROKER_STATUS[broker.status]?.label || 'Unknown'
    if (!window.confirm(`Toggle status for ${broker.name}? Current: ${label}`)) return
    await brokersService.toggleStatus(broker.id)
    reload()
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-3 gap-2">
        <h5 className="mb-0 me-auto">Brokers</h5>
        <input
          className="form-control form-control-sm w-auto"
          placeholder="Name, MC or DBA…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Link to="/brokers/create" className="btn btn-sm btn-primary">
          <i className="bi bi-plus-lg me-1" />
          New Broker
        </Link>
      </div>

      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <table className="table table-sm table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Name</th>
              <th>MC</th>
              <th>DBA</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Carrier</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link to={`/brokers/${b.id}`}>{b.name}</Link>
                </td>
                <td>{b.mc}</td>
                <td>{b.dba_name}</td>
                <td>{b.email}</td>
                <td>{b.phone}</td>
                <td>{b.carrier_name || '—'}</td>
                <td>
                  <StatusBadge status={b.status} />
                </td>
                <td className="text-end">
                  <Link
                    to={`/brokers/${b.id}/edit`}
                    className="btn btn-sm btn-outline-secondary me-1"
                    title="Edit"
                  >
                    <i className="bi bi-pencil" />
                  </Link>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    title="Toggle status"
                    onClick={() => handleToggle(b)}
                  >
                    <i className="bi bi-arrow-repeat" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className="text-muted small">
                {visible.length} broker{visible.length !== 1 ? 's' : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
