import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTrailer } from '../../hooks/useTrailer';
import { useOptions } from '../../hooks/useOptions';
import { trailersService, TRAILER_STATUS } from '../../services/trailers';
import { SectionCard, Field, YesNo, Money } from '../../components/DetailSection';
import TrailerFiles from './TrailerFiles';

function StatusBadge({ status, isRented }) {
  if (isRented) return <span className="badge bg-warning text-dark">Rented</span>;
  const s = TRAILER_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

export default function TrailerDetailPage() {
  const { id } = useParams();
  const { trailer, loading, error, refresh } = useTrailer(id);
  const [actioning, setActioning] = useState(false);

  const owners = useOptions('/fleet/owners/');
  const carriers = useOptions('/carriers/');
  const states = useOptions('/locations/states/');

  const toggleStatus = async () => {
    if (!window.confirm('Toggle status for this trailer?')) return;
    setActioning(true);
    try {
      await trailersService.toggleStatus(trailer.id);
      refresh();
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  if (error || !trailer) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Trailer not found.</span>
        <Link to="/fleet/trailers" className="btn btn-sm btn-outline-secondary">Back to Trailers</Link>
      </div>
    );
  }

  const nameById = (list, id, key = 'name') => {
    const match = list.find((x) => x.id === id);
    return match ? match[key] : null;
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div className="d-flex align-items-center gap-3">
          <Link to="/fleet/trailers" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0"><i className="bi bi-truck-flatbed me-2" />Trailer {trailer.number}</h5>
          <StatusBadge status={trailer.status} isRented={trailer.is_rented} />
        </div>
        <div className="d-flex gap-1 flex-wrap">
          <Link to={`/fleet/trailers/${trailer.id}/edit`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button className="btn btn-sm btn-outline-dark" disabled={actioning} onClick={toggleStatus}>
            <i className="bi bi-toggle-on me-1" />Toggle Status
          </button>
        </div>
      </div>

      <SectionCard title="Identity" icon="bi-card-heading">
        <Field label="Number">{trailer.number}</Field>
        <Field label="VIN">{trailer.vin}</Field>
        <Field label="Year">{trailer.year}</Field>
        <Field label="Type">{trailer.trailer_type_name}</Field>
        <Field label="Width">{trailer.width ? `${trailer.width} ft` : null}</Field>
        <Field label="Height">{trailer.height ? `${trailer.height} ft` : null}</Field>
      </SectionCard>

      <SectionCard title="Plate" icon="bi-credit-card-2-front">
        <Field label="Plate Number">{trailer.plate_number}</Field>
        <Field label="Plate State">{trailer.plate_state_name || nameById(states, trailer.plate_state)}</Field>
      </SectionCard>

      <SectionCard title="Compliance" icon="bi-shield-check">
        <Field label="AI Expiration">{trailer.annual_inspection_expiration}</Field>
      </SectionCard>

      <SectionCard title="Purchase" icon="bi-cash-stack">
        <Field label="Purchase Date">{trailer.purchase_date}</Field>
        <Field label="Purchase Cost"><Money value={trailer.purchase_cost} /></Field>
        <Field label="Rented"><YesNo value={trailer.is_rented} /></Field>
        <Field label="Loss Payee">{trailer.loss_payee}</Field>
      </SectionCard>

      <SectionCard title="Carrier Assignment" icon="bi-building">
        <Field label="Owner">{trailer.owner_name || nameById(owners, trailer.owner)}</Field>
        <Field label="Carrier">{trailer.carrier_name || nameById(carriers, trailer.carrier)}</Field>
        <Field label="Carrier Start">{trailer.carrier_start_date}</Field>
        <Field label="Carrier End">{trailer.carrier_end_date}</Field>
        <Field label="End Reason">{trailer.carrier_end_reason}</Field>
      </SectionCard>

      <TrailerFiles trailerId={trailer.id} trailer={trailer} onChange={refresh} />

      {Array.isArray(trailer.maintenance_records) && trailer.maintenance_records.length > 0 && (
        <div className="card mb-3">
          <div className="card-header py-2 bg-light">
            <span className="fw-semibold"><i className="bi bi-wrench me-2" />Maintenance Records</span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr><th>Date</th><th>Detail</th><th>Miles</th></tr>
              </thead>
              <tbody>
                {trailer.maintenance_records.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date ?? '—'}</td>
                    <td>{m.detail ?? '—'}</td>
                    <td>{m.miles ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
