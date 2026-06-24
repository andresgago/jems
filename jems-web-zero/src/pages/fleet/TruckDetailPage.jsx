import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTruck } from '../../hooks/useTruck';
import { useOptions } from '../../hooks/useOptions';
import { trucksService, TRUCK_STATUS } from '../../services/trucks';
import { SectionCard, Field, YesNo, Money } from '../../components/DetailSection';
import TruckFiles from './TruckFiles';

function StatusBadge({ status }) {
  const s = TRUCK_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

const nameById = (list, id, key = 'name') => {
  const match = list.find((x) => x.id === id);
  return match ? match[key] : null;
};

export default function TruckDetailPage() {
  const { id } = useParams();
  const { truck, loading, error, refresh } = useTruck(id);
  const [actioning, setActioning] = useState(false);

  const makes = useOptions('/fleet/makes/');
  const engineTypes = useOptions('/fleet/engine-types/');
  const cabinTypes = useOptions('/fleet/cabin-types/');
  const transmissionTypes = useOptions('/fleet/transmission-types/');
  const tireSizes = useOptions('/fleet/tire-sizes/');
  const owners = useOptions('/fleet/owners/');
  const carriers = useOptions('/carriers/');
  const users = useOptions('/users/');
  const lossPayees = useOptions('/fleet/loss-payees/');
  const cards = useOptions('/fleet/cards/');

  const toggleStatus = async () => {
    if (!window.confirm('Toggle status for this truck?')) return;
    setActioning(true);
    try {
      await trucksService.toggleStatus(truck.id);
      refresh();
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  if (error || !truck) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Truck not found.</span>
        <Link to="/fleet/trucks" className="btn btn-sm btn-outline-secondary">Back to Trucks</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div className="d-flex align-items-center gap-3">
          <Link to="/fleet/trucks" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0"><i className="bi bi-truck me-2" />Truck {truck.number}</h5>
          <StatusBadge status={truck.status} />
        </div>
        <div className="d-flex gap-1 flex-wrap">
          <Link to={`/fleet/trucks/${truck.id}/edit`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button className="btn btn-sm btn-outline-dark" disabled={actioning} onClick={toggleStatus}>
            <i className="bi bi-toggle-on me-1" />Toggle Status
          </button>
        </div>
      </div>

      <SectionCard title="Identity" icon="bi-card-heading">
        <Field label="Number">{truck.number}</Field>
        <Field label="VIN">{truck.vin}</Field>
        <Field label="Year">{truck.year}</Field>
        <Field label="Type">{truck.truck_type_name}</Field>
        <Field label="Plate">{truck.plate}</Field>
        <Field label="Transponder">{truck.transponder}</Field>
      </SectionCard>

      <SectionCard title="Specs" icon="bi-gear">
        <Field label="Make">{nameById(makes, truck.make)}</Field>
        <Field label="Engine">{nameById(engineTypes, truck.engine_type)}</Field>
        <Field label="Cabin / Model">{nameById(cabinTypes, truck.cabin_type)}</Field>
        <Field label="Transmission">{nameById(transmissionTypes, truck.transmission_type)}</Field>
        <Field label="Tire Size">{nameById(tireSizes, truck.tire_size)}</Field>
        <Field label="Gross Weight">{truck.gross_weight ? `${Number(truck.gross_weight).toLocaleString()} lb` : '—'}</Field>
        <Field label="Odometer">{truck.odometer_current ? Number(truck.odometer_current).toLocaleString() : '—'}</Field>
      </SectionCard>

      <SectionCard title="Compliance" icon="bi-shield-check">
        <Field label="AVI Expiration">{truck.avi_expiration}</Field>
        <Field label="Registration Expiration">{truck.registration_expiration}</Field>
      </SectionCard>

      <SectionCard title="Purchase & Financing" icon="bi-cash-stack">
        <Field label="Purchase Date">{truck.purchase_date}</Field>
        <Field label="Purchase Cost"><Money value={truck.purchase_cost} /></Field>
        <Field label="Leased"><YesNo value={truck.is_leased} /></Field>
        <Field label="Leased Name">{truck.leased_name}</Field>
        <Field label="Loan Term">{truck.loan_term}</Field>
        <Field label="Interest Rate">{truck.interest_rate}</Field>
        <Field label="Monthly Bill">{truck.monthly_bill}</Field>
        <Field label="Remaining Balance">{truck.remaining_balance}</Field>
        <Field label="Loss Payee">{nameById(lossPayees, truck.loss_payee)}</Field>
      </SectionCard>

      <SectionCard title="Assignments" icon="bi-link-45deg">
        <Field label="Dispatcher">{nameById(users, truck.dispatcher, 'full_name')}</Field>
        <Field label="Owner">{nameById(owners, truck.owner, 'full_name')}</Field>
        <Field label="Fuel Card">{nameById(cards, truck.fuel_card, 'number')}</Field>
        <Field label="Carrier">{nameById(carriers, truck.carrier)}</Field>
        <Field label="Carrier Start">{truck.carrier_start_date}</Field>
        <Field label="Carrier End">{truck.carrier_end_date}</Field>
      </SectionCard>

      <SectionCard title="ELD" icon="bi-broadcast">
        <Field label="MAC Address">{truck.mac_address}</Field>
        <Field label="Serial Number">{truck.serial_number}</Field>
        <Field label="ELD Company">{truck.eld_company}</Field>
      </SectionCard>

      <TruckFiles truckId={truck.id} truck={truck} onChange={refresh} />

      {Array.isArray(truck.maintenance_records) && truck.maintenance_records.length > 0 && (
        <div className="card mb-3">
          <div className="card-header py-2 bg-light">
            <span className="fw-semibold"><i className="bi bi-wrench me-2" />Maintenance Records</span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr><th>Date</th><th>Detail</th><th>Odometer Start</th><th>Odometer Current</th></tr>
              </thead>
              <tbody>
                {truck.maintenance_records.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date ?? '—'}</td>
                    <td>{m.detail ?? '—'}</td>
                    <td>{m.odometer_start ?? '—'}</td>
                    <td>{m.odometer_current ?? '—'}</td>
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
