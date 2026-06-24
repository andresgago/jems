import { useParams, Link } from 'react-router-dom'
import { useBroker } from '../../hooks/useBroker'
import { SectionCard, Field } from '../../components/DetailSection'
import { BROKER_STATUS, brokersService } from '../../services/brokers'
import { mediaUrl } from '../../utils/media'
import BrokerContacts from './BrokerContacts'

function StatusBadge({ status }) {
  const s = BROKER_STATUS[status] || { label: 'Unknown', cls: 'secondary' }
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>
}

export default function BrokerDetailPage() {
  const { id } = useParams()
  const { item: broker, loading, reload } = useBroker(id)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await brokersService.uploadFile(id, 'setup-packet', file)
    reload()
    e.target.value = ''
  }

  const handleFileClear = async () => {
    if (!window.confirm('Remove setup packet?')) return
    await brokersService.deleteFile(id, 'setup-packet')
    reload()
  }

  if (loading) return <div className="container-fluid py-3 text-muted">Loading…</div>
  if (!broker) return <div className="container-fluid py-3 text-danger">Broker not found.</div>

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-3 gap-2">
        <h5 className="mb-0 me-auto">
          {broker.name}
          <span className="ms-2">
            <StatusBadge status={broker.status} />
          </span>
        </h5>
        <Link to={`/brokers/${id}/edit`} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-pencil me-1" />
          Edit
        </Link>
        <Link to="/brokers" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left me-1" />
          Back
        </Link>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <SectionCard title="Identity" icon="bi-building">
            <Field label="MC">{broker.mc}</Field>
            <Field label="Legal Name">{broker.name}</Field>
            <Field label="DBA / Short Name">{broker.dba_name}</Field>
            <Field label="Carrier">{broker.carrier_name}</Field>
          </SectionCard>
        </div>
        <div className="col-md-6">
          <SectionCard title="Contact Info" icon="bi-envelope">
            <Field label="Email">{broker.email}</Field>
            <Field label="Accounting Email">{broker.accounting_email}</Field>
            <Field label="Phone">{broker.phone}</Field>
          </SectionCard>
        </div>
        <div className="col-md-6">
          <SectionCard title="Address" icon="bi-geo-alt">
            <Field label="Physical Address">{broker.physical_address}</Field>
            <Field label="Mailing Address">{broker.mailing_address}</Field>
            <Field label="City">{broker.city_name}</Field>
            <Field label="State">{broker.state_name}</Field>
            <Field label="ZIP">{broker.zip}</Field>
          </SectionCard>
        </div>
        <div className="col-md-6">
          <SectionCard title="Compliance" icon="bi-shield-check">
            <Field label="USDOT Number">{broker.usdot_number}</Field>
            <Field label="SAFER Operating Status">{broker.safer_operating_status}</Field>
            <Field label="Buy Status">{broker.buy_status}</Field>
            <Field label="Debtor Buy Status">{broker.debtor_buy_status}</Field>
            <Field label="Checked At">{broker.checked_at}</Field>
          </SectionCard>
        </div>
        <div className="col-md-6">
          <SectionCard title="Factoring" icon="bi-cash-stack">
            <Field label="Factor Company">{broker.factor_company}</Field>
            <Field label="Factor Account ID">{broker.factor_account_id}</Field>
          </SectionCard>
        </div>
        <div className="col-md-6">
          <SectionCard title="Setup Packet" icon="bi-file-earmark-pdf">
            <table className="table table-sm mb-0">
              <tbody>
                <tr>
                  <td>Setup Packet</td>
                  <td>
                    {broker.setup_packet_file ? (
                      <a
                        href={mediaUrl(broker.setup_packet_file)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-primary me-2"
                      >
                        <i className="bi bi-download me-1" />
                        Download
                      </a>
                    ) : (
                      <span className="text-muted me-2">No file</span>
                    )}
                    <label className="btn btn-sm btn-outline-secondary me-1">
                      <i className="bi bi-upload me-1" />
                      {broker.setup_packet_file ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept=".pdf"
                        className="d-none"
                        onChange={handleFileUpload}
                      />
                    </label>
                    {broker.setup_packet_file && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title="Remove setup packet"
                        onClick={handleFileClear}
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </SectionCard>
        </div>
        {broker.details && (
          <div className="col-12">
            <SectionCard title="Notes" icon="bi-chat-left-text">
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{broker.details}</p>
            </SectionCard>
          </div>
        )}
        <div className="col-12">
          <SectionCard title="Contacts" icon="bi-people">
            <BrokerContacts
              brokerId={broker.id}
              contacts={broker.contacts || []}
              onChanged={reload}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
