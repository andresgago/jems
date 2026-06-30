import { useState, useEffect, useCallback } from 'react';
import { milesResetService } from '../../services/milesReset';
import { trucksService } from '../../services/trucks';

const TODAY = new Date().toISOString().split('T')[0];

export default function TruckMilesResetPage() {
  const [resets, setResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trucks, setTrucks] = useState([]);

  const [truckFilter, setTruckFilter] = useState('');
  const [formTruck, setFormTruck] = useState('');
  const [formDate, setFormDate] = useState(TODAY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = truckFilter ? { truck: truckFilter } : {};
      const res = await milesResetService.list(params);
      setResets(res.data);
    } catch {
      setError('Error loading miles reset records.');
    } finally {
      setLoading(false);
    }
  }, [truckFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    trucksService.list().then((r) => setTrucks(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formTruck) { setFormError('Select a truck.'); return; }
    if (!formDate) { setFormError('Date is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await milesResetService.create({ truck: Number(formTruck), date: formDate });
      setFormTruck('');
      setFormDate(TODAY);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Error creating reset record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this miles reset record?')) return;
    try {
      await milesResetService.destroy(id);
      load();
    } catch {
      alert('Error deleting record.');
    }
  };

  const truckName = (id) => trucks.find((t) => t.id === id)?.number ?? String(id);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-speedometer2 me-2" />Trucks Miles Reset
        </h5>
      </div>

      <div className="card mb-3">
        <div className="card-header py-2 bg-light fw-semibold">Create New Reset</div>
        <div className="card-body">
          <form onSubmit={handleCreate}>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Truck <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={formTruck}
                  onChange={(e) => setFormTruck(e.target.value)}
                >
                  <option value="">Select truck…</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>{t.number}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Reset Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className="form-control"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div className="col-auto">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Reset Miles'}
                </button>
              </div>
            </div>
            {formError && <div className="text-danger small mt-2">{formError}</div>}
          </form>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Filter by truck</label>
              <select
                className="form-select form-select-sm"
                value={truckFilter}
                onChange={(e) => setTruckFilter(e.target.value)}
              >
                <option value="">All trucks</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>{t.number}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Date</th>
                  <th>Truck</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={3} className="text-center py-4 text-muted">Loading…</td></tr>
                )}
                {!loading && resets.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-4 text-muted">No reset records found.</td></tr>
                )}
                {!loading && resets.map((r) => (
                  <tr key={r.id}>
                    <td className="align-middle fw-semibold">{r.date}</td>
                    <td className="align-middle">{truckName(r.truck)}</td>
                    <td className="align-middle text-center">
                      <button
                        className="btn btn-sm btn-outline-danger py-0"
                        onClick={() => handleDelete(r.id)}
                        title="Delete"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
