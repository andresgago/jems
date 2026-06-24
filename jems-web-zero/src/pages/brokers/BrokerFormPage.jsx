import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOptions } from '../../hooks/useOptions'
import { brokersService } from '../../services/brokers'

const INITIAL = {
  mc: '', name: '', dba_name: '', email: '', phone: '', accounting_email: '',
  status: '1',
  factor_company: '', factor_account_id: '', buy_status: '', debtor_buy_status: '',
  details: '', checked_at: '',
  physical_address: '', mailing_address: '',
  city: '', state: '', zip: '',
  usdot_number: '', safer_operating_status: '',
  carrier: '',
}

const FK_FIELDS = ['city', 'state', 'carrier']
const DATE_FIELDS = ['checked_at']

function Section({ title, icon, children }) {
  return (
    <div className="card mb-3">
      <div className="card-header py-2 fw-semibold">
        <i className={`bi ${icon} me-2`} />{title}
      </div>
      <div className="card-body">
        <div className="row g-3">{children}</div>
      </div>
    </div>
  )
}

function Text({ label, value, onChange, required, invalid, type = 'text', col = 'col-md-6', as: Tag = 'input' }) {
  return (
    <div className={col}>
      <label className="form-label">
        {label}{required && <span className="text-danger ms-1">*</span>}
      </label>
      <Tag
        type={Tag === 'input' ? type : undefined}
        className={`form-control${invalid ? ' is-invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {invalid && <div className="invalid-feedback">{invalid}</div>}
    </div>
  )
}

function Select({ label, value, onChange, options, col = 'col-md-6' }) {
  return (
    <div className={col}>
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name || o.full_name || o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function BrokerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const carriers = useOptions('/carriers/')
  const states = useOptions('/locations/states/')

  useEffect(() => {
    if (!isEdit) return
    brokersService.get(id).then((r) => {
      const d = r.data
      setForm({
        mc: d.mc || '',
        name: d.name || '',
        dba_name: d.dba_name || '',
        email: d.email || '',
        phone: d.phone || '',
        accounting_email: d.accounting_email || '',
        status: String(d.status ?? 1),
        factor_company: d.factor_company || '',
        factor_account_id: d.factor_account_id || '',
        buy_status: d.buy_status || '',
        debtor_buy_status: d.debtor_buy_status || '',
        details: d.details || '',
        checked_at: d.checked_at || '',
        physical_address: d.physical_address || '',
        mailing_address: d.mailing_address || '',
        city: d.city != null ? String(d.city) : '',
        state: d.state != null ? String(d.state) : '',
        zip: d.zip || '',
        usdot_number: d.usdot_number || '',
        safer_operating_status: d.safer_operating_status || '',
        carrier: d.carrier != null ? String(d.carrier) : '',
      })
    })
  }, [id, isEdit])

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const buildPayload = () => {
    const payload = { ...form }
    for (const f of FK_FIELDS) {
      payload[f] = payload[f] !== '' ? payload[f] : null
    }
    for (const f of DATE_FIELDS) {
      payload[f] = payload[f] !== '' ? payload[f] : null
    }
    payload.status = Number(payload.status)
    if (!payload.email) payload.email = null
    if (!payload.accounting_email) payload.accounting_email = null
    return payload
  }

  const validate = () => {
    const errs = {}
    if (!form.mc.trim()) errs.mc = 'Required'
    if (!form.name.trim()) errs.name = 'Required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isEdit) {
        await brokersService.update(id, payload)
        navigate(`/brokers/${id}`)
      } else {
        const res = await brokersService.create(payload)
        navigate(`/brokers/${res.data.id}`)
      }
    } catch {
      setErrors({ _global: 'Save failed. Check for duplicate MC or email.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center mb-3">
        <h5 className="mb-0">{isEdit ? 'Edit Broker' : 'New Broker'}</h5>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <Section title="Identity" icon="bi-building">
          <Text
            label="MC"
            value={form.mc}
            onChange={(v) => set('mc', v)}
            required
            invalid={errors.mc}
            col="col-md-4"
          />
          <Text
            label="Legal Name"
            value={form.name}
            onChange={(v) => set('name', v)}
            required
            invalid={errors.name}
            col="col-md-8"
          />
          <Text label="DBA / Short Name" value={form.dba_name} onChange={(v) => set('dba_name', v)} />
          <Select label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} options={carriers} />
          <div className="col-md-4">
            <label className="form-label">
              Status<span className="text-danger ms-1">*</span>
            </label>
            <select className="form-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </Section>

        <Section title="Contact Info" icon="bi-envelope">
          <Text label="Email" value={form.email} onChange={(v) => set('email', v)} type="email" />
          <Text label="Accounting Email" value={form.accounting_email} onChange={(v) => set('accounting_email', v)} type="email" />
          <Text label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
        </Section>

        <Section title="Address" icon="bi-geo-alt">
          <Text label="Physical Address" value={form.physical_address} onChange={(v) => set('physical_address', v)} col="col-md-8" />
          <Text label="Mailing Address" value={form.mailing_address} onChange={(v) => set('mailing_address', v)} col="col-md-8" />
          <Select label="State" value={form.state} onChange={(v) => set('state', v)} options={states} col="col-md-4" />
          <Text label="ZIP" value={form.zip} onChange={(v) => set('zip', v)} col="col-md-3" />
        </Section>

        <Section title="Compliance" icon="bi-shield-check">
          <Text label="USDOT Number" value={form.usdot_number} onChange={(v) => set('usdot_number', v)} col="col-md-4" />
          <Text label="SAFER Operating Status" value={form.safer_operating_status} onChange={(v) => set('safer_operating_status', v)} col="col-md-4" />
          <Text label="Buy Status" value={form.buy_status} onChange={(v) => set('buy_status', v)} col="col-md-4" />
          <Text label="Debtor Buy Status" value={form.debtor_buy_status} onChange={(v) => set('debtor_buy_status', v)} col="col-md-4" />
          <Text label="Checked At" value={form.checked_at} onChange={(v) => set('checked_at', v)} type="date" col="col-md-4" />
        </Section>

        <Section title="Factoring" icon="bi-cash-stack">
          <Text label="Factor Company" value={form.factor_company} onChange={(v) => set('factor_company', v)} />
          <Text label="Factor Account ID" value={form.factor_account_id} onChange={(v) => set('factor_account_id', v)} />
        </Section>

        <Section title="Notes" icon="bi-chat-left-text">
          <Text label="Details" value={form.details} onChange={(v) => set('details', v)} as="textarea" col="col-12" />
        </Section>

        {errors._global && <div className="alert alert-danger">{errors._global}</div>}

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Broker'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
