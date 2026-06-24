import { Link, useParams } from 'react-router-dom';
import { useRtlDriver } from '../../hooks/useRtlDriver';
import { getHosStatus } from '../../services/rtl';
import { SectionCard, Field } from '../../components/DetailSection';

function HosBadge({ code }) {
  const s = getHosStatus(code);
  return <span className={`badge bg-${s.cls}`}>{s.label || 'Off Duty'}</span>;
}

export default function RtlDriverDetailPage() {
  const { id } = useParams();
  const { item: driver, loading, error } = useRtlDriver(id);

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  if (error || !driver) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>RTL driver not found.</span>
        <Link to="/rtl" className="btn btn-sm btn-outline-secondary">Back to RTL</Link>
      </div>
    );
  }

  const status = driver.latest_status;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Link to="/rtl" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0">{driver.first_name} {driver.last_name}</h5>
          <span className={`badge bg-${driver.active ? 'success' : 'secondary'}`}>
            {driver.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <SectionCard title="Driver Info" icon="bi-person-vcard">
        <Field label="First Name">{driver.first_name}</Field>
        <Field label="Last Name">{driver.last_name}</Field>
        <Field label="Email">{driver.email}</Field>
        <Field label="Phone">{driver.phone_num}</Field>
        <Field label="License Number">{driver.license_number}</Field>
        <Field label="License State">{driver.license_state}</Field>
      </SectionCard>

      <SectionCard title="HOS Status" icon="bi-clock-history">
        {status ? (
          <>
            <Field label="Status">
              <HosBadge code={status.hos_event_code} />
            </Field>
            <Field label="Event Code">{status.hos_event_code}</Field>
            <Field label="Event Time">{status.hos_event_time}</Field>
            <Field label="Location State">{status.location_state}</Field>
            <Field label="Latitude">{status.location_lat}</Field>
            <Field label="Longitude">{status.location_lon}</Field>
            <Field label="Vehicle VIN">{status.vehicle_vin}</Field>
            <Field label="Daily Hours Driven">
              {status.daily_hours_driven != null
                ? `${Number(status.daily_hours_driven).toFixed(1)} h`
                : null}
            </Field>
            <Field label="Daily Hours On Duty">
              {status.daily_hours_on_duty != null
                ? `${Number(status.daily_hours_on_duty).toFixed(1)} h`
                : null}
            </Field>
            <Field label="ETA">{status.eta}</Field>
            <Field label="Synced At">{status.synced_at}</Field>
          </>
        ) : (
          <div className="col-12 text-muted">No HOS status available.</div>
        )}
      </SectionCard>

      <SectionCard title="Sync Info" icon="bi-arrow-repeat">
        <Field label="RTL ID">{driver.rtl_id}</Field>
        <Field label="Company ID">{driver.company_id}</Field>
        <Field label="Synced At">{driver.synced_at}</Field>
      </SectionCard>
    </div>
  );
}
