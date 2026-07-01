import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDriver } from '../../hooks/useDriver';
import { useOptions } from '../../hooks/useOptions';
import { driversService, DRIVER_CONTRACT, DRIVER_PAY_VACATION, DRIVER_STATUS } from '../../services/drivers';
import { SectionCard, Field, YesNo, Money } from '../../components/DetailSection';
import DriverDocuments from './DriverDocuments';
import DriverPhoto from './DriverPhoto';

function StatusBadge({ status }) {
  const s = DRIVER_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

export default function DriverDetailPage() {
  const { id } = useParams();
  const { driver, loading, error, refresh } = useDriver(id);
  const carriers = useOptions('/carriers/');
  const states = useOptions('/locations/states/');
  const [actioning, setActioning] = useState(false);

  const toggleStatus = async () => {
    if (!window.confirm('Toggle status for this driver?')) return;
    setActioning(true);
    try {
      await driversService.toggleStatus(driver.id);
      refresh();
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  if (error || !driver) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Driver not found.</span>
        <Link to="/drivers" className="btn btn-sm btn-outline-secondary">Back to Drivers</Link>
      </div>
    );
  }

  const carrier = carriers.find((c) => c.id === driver.carrier);
  const state = states.find((s) => s.id === driver.license_state);

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Link to="/drivers" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <DriverPhoto driverId={driver.id} photo={driver.photo} onChange={refresh} />
          <h5 className="mb-0">{driver.full_name}</h5>
          <StatusBadge status={driver.status} />
          {driver.on_vacation && (
            <span className="badge bg-info-subtle text-info-emphasis">On Vacation</span>
          )}
        </div>
        <div className="d-flex gap-1 flex-wrap">
          <Link to={`/drivers/${driver.id}/edit`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button className="btn btn-sm btn-outline-dark" disabled={actioning} onClick={toggleStatus}>
            <i className="bi bi-toggle-on me-1" />Toggle Status
          </button>
        </div>
      </div>

      <SectionCard title="Personal" icon="bi-person-vcard">
        <Field label="Driver Type">{driver.driver_type_name}</Field>
        <Field label="Phone">{driver.phone}</Field>
        <Field label="Email">{driver.email}</Field>
        <Field label="Address">{driver.address}</Field>
        <Field label="Birth Date">{driver.birth_date}</Field>
      </SectionCard>

      <SectionCard title="Employment" icon="bi-briefcase">
        <Field label="Hire Date">{driver.hire_date}</Field>
        <Field label="Termination Date">{driver.termination_date}</Field>
        <Field label="Contract">{driver.contract_display || DRIVER_CONTRACT[driver.contract]}</Field>
        <Field label="Pay Vacation">{driver.pay_vacation_display || DRIVER_PAY_VACATION[driver.pay_vacation]}</Field>
        <Field label="On Vacation"><YesNo value={driver.on_vacation} /></Field>
      </SectionCard>

      <SectionCard title="License & Medical" icon="bi-card-heading">
        <Field label="License Number">{driver.license_number}</Field>
        <Field label="License State">{state ? `${state.name} (${state.abbreviation})` : null}</Field>
        <Field label="License Expiration">{driver.license_expiration}</Field>
        <Field label="Medical Card Expiration">{driver.medical_card_expiration}</Field>
        <Field label="MVR Expiration">{driver.mvr_expiration}</Field>
      </SectionCard>

      <SectionCard title="Carrier" icon="bi-truck-front">
        <Field label="Carrier">{carrier ? carrier.name : (driver.carrier ? `#${driver.carrier}` : null)}</Field>
        <Field label="Start Date">{driver.carrier_start_date}</Field>
        <Field label="End Date">{driver.carrier_end_date}</Field>
        <Field label="End Reason">{driver.carrier_end_reason}</Field>
      </SectionCard>

      <SectionCard title="Compensation" icon="bi-cash-stack">
        <Field label="Miles (Empty)">{driver.miles_empty}</Field>
        <Field label="Miles (Full)">{driver.miles_full}</Field>
        <Field label="Percent">{driver.percent ? `${driver.percent}%` : '0%'}</Field>
        <Field label="Weekly Rate"><Money value={driver.weekly_rate} /></Field>
      </SectionCard>

      <SectionCard title="Deductions" icon="bi-dash-circle">
        <Field label="Insurance"><Money value={driver.insurance} /></Field>
        <Field label="ELD"><Money value={driver.eld} /></Field>
        <Field label="Worker Comp"><Money value={driver.worker_comp} /></Field>
        <Field label="Factor"><Money value={driver.factor} /></Field>
        <Field label="Factor Fee"><Money value={driver.factor_fee} /></Field>
      </SectionCard>

      <SectionCard title="Assignments & CDL" icon="bi-link-45deg">
        <Field label="Fuel Card">{driver.fuel_card ? `#${driver.fuel_card}` : null}</Field>
        <Field label="Team Driver">{driver.team_driver ? `Driver #${driver.team_driver}` : null}</Field>
        <Field label="Endorsements">{driver.endorsements || '0'}</Field>
        <Field label="Restrictions">{driver.restrictions || '0'}</Field>
        <Field label="ELD ID">{driver.eld_id}</Field>
        <Field label="Factoring Account ID">{driver.factoring_account_id}</Field>
      </SectionCard>

      <DriverDocuments driverId={driver.id} documents={driver.documents} onChange={refresh} />
    </div>
  );
}
