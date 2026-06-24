import { useEffect, useState } from 'react';
import { usersService } from '../../services/users';

export default function SystemSettingsPage() {
  const [config, setConfig] = useState(null);
  const [displayOptions, setDisplayOptions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    usersService.getConfig().then(({ data }) => setConfig(data));
    usersService.getDisplayOptions().then(({ data }) => setDisplayOptions(data));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const [{ data: nextConfig }, { data: nextOptions }] = await Promise.all([
        usersService.updateConfig(config),
        usersService.updateDisplayOptions(displayOptions),
      ]);
      setConfig(nextConfig);
      setDisplayOptions(nextOptions);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!config || !displayOptions) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">System Settings</h4>
        {saved && <span className="badge bg-success">Saved</span>}
      </div>

      <form onSubmit={save}>
        <div className="card mb-3">
          <div className="card-header py-2 bg-light"><span className="fw-semibold"><i className="bi bi-receipt me-2" />Invoice Counters</span></div>
          <div className="card-body">
            <div className="row g-3">
              <Input label="Dispatcher Hour" type="number" value={config.dispatcher_invoice_hour} onChange={(v) => setConfig((c) => ({ ...c, dispatcher_invoice_hour: Number(v) }))} />
              <Input label="Dispatcher Percent" type="number" value={config.dispatcher_invoice_percent} onChange={(v) => setConfig((c) => ({ ...c, dispatcher_invoice_percent: Number(v) }))} />
              <Input label="Driver Invoice" type="number" value={config.driver_invoice} onChange={(v) => setConfig((c) => ({ ...c, driver_invoice: Number(v) }))} />
              <Input label="Owner Invoice" type="number" value={config.owner_invoice} onChange={(v) => setConfig((c) => ({ ...c, owner_invoice: Number(v) }))} />
              <Input label="Start Hour" type="time" value={config.start_hours_work_dispatcher} onChange={(v) => setConfig((c) => ({ ...c, start_hours_work_dispatcher: v }))} />
              <Input label="End Hour" type="time" value={config.end_hours_work_dispatcher} onChange={(v) => setConfig((c) => ({ ...c, end_hours_work_dispatcher: v }))} />
            </div>
          </div>
        </div>

        <div className="card mb-3">
          <div className="card-header py-2 bg-light"><span className="fw-semibold"><i className="bi bi-layout-text-window me-2" />Display Options</span></div>
          <div className="card-body">
            <div className="row g-3">
              <Input label="Truck Fields" value={displayOptions.truck} onChange={(v) => setDisplayOptions((o) => ({ ...o, truck: v }))} />
              <Input label="Trailer Fields" value={displayOptions.trailer} onChange={(v) => setDisplayOptions((o) => ({ ...o, trailer: v }))} />
              <Input label="Driver Fields" value={displayOptions.driver} onChange={(v) => setDisplayOptions((o) => ({ ...o, driver: v }))} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
          Save Settings
        </button>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div className="col-md-4">
      <label className="control-label">{label}</label>
      <input className="form-control form-control-sm" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
