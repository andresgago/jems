import { useEffect, useState } from 'react';
import api from '../../services/api';

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  owner_type: '2',
  percent: '0',
  insurance: '0',
  truck_amount: '0',
  driver_amount: '0',
  truck_yard_rent: '0',
};

export default function TruckOwnersPage() {
  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadOwners = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fleet/owners/');
      setOwners(data);
      setError('');
    } catch {
      setError('Error loading truck owners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwners();
  }, []);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const createOwner = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/fleet/owners/', {
        ...form,
        status: 1,
        owner_type: Number(form.owner_type),
        percent: Number(form.percent || 0),
        insurance: Number(form.insurance || 0),
        truck_amount: Number(form.truck_amount || 0),
        driver_amount: Number(form.driver_amount || 0),
        truck_yard_rent: Number(form.truck_yard_rent || 0),
      });
      setForm(EMPTY);
      await loadOwners();
    } catch (err) {
      const data = err?.response?.data;
      setError(data && typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Error saving truck owner.');
    } finally {
      setSaving(false);
    }
  };

  const removeOwner = async (owner) => {
    if (!window.confirm('Are you sure to delete this item?')) return;
    await api.delete(`/fleet/owners/${owner.id}/`);
    await loadOwners();
  };

  return (
    <div className="legacy-grid-page">
      <div className="legacy-grid-title">
        <h5><i className="bi bi-list me-1" />Truck Owners</h5>
        <span>Showing {owners.length ? 1 : 0}-{owners.length} of {owners.length} items.</span>
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}

      <form className="legacy-grid-toolbar flex-wrap justify-content-start" onSubmit={createOwner}>
        <input className="form-control form-control-sm legacy-owner-input" placeholder="First Name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
        <input className="form-control form-control-sm legacy-owner-input" placeholder="Last Name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
        <input className="form-control form-control-sm legacy-owner-input" placeholder="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <input className="form-control form-control-sm legacy-owner-input" placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <select className="form-select form-select-sm legacy-owner-type" value={form.owner_type} onChange={(e) => set('owner_type', e.target.value)}>
          <option value="2">Owner Operator</option>
          <option value="1">Company</option>
        </select>
        <button className="btn btn-sm btn-primary" type="submit" disabled={saving}>
          <i className="bi bi-plus-lg me-1" />New Owner
        </button>
      </form>

      <div className="legacy-grid-wrap">
        <table className="table table-sm table-hover mb-0 legacy-grid-table truck-owners-grid-table">
          <thead>
            <tr>
              <th className="serial-col">#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Status</th>
              <th>Percent</th>
              <th>Insurance</th>
              <th>Truck Amount</th>
              <th>Driver Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>}
            {!loading && owners.length === 0 && <tr><td colSpan={11} className="text-center text-muted py-4">No truck owners found.</td></tr>}
            {!loading && owners.map((owner, index) => (
              <tr key={owner.id} className={owner.status !== 1 ? 'row-desactivada' : ''}>
                <td className="text-center">{index + 1}</td>
                <td className="fw-semibold">{owner.full_name}</td>
                <td>{owner.email || <span className="text-muted">—</span>}</td>
                <td>{owner.phone || <span className="text-muted">—</span>}</td>
                <td className="text-center">{owner.owner_type === 1 ? 'Company' : 'Owner Operator'}</td>
                <td className="text-center">{owner.status === 1 ? 'Active' : 'Inactive'}</td>
                <td className="text-end">{owner.percent}</td>
                <td className="text-end">{owner.insurance}</td>
                <td className="text-end">{owner.truck_amount}</td>
                <td className="text-end">{owner.driver_amount}</td>
                <td className="text-center">
                  <button className="btn btn-link btn-sm p-0 text-danger" type="button" title="Delete" onClick={() => removeOwner(owner)}>
                    <i className="bi bi-trash-fill" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
