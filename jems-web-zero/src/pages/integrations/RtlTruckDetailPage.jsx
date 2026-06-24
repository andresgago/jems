import { Link, useParams } from 'react-router-dom';
import { useRtlTruck } from '../../hooks/useRtlTruck';
import { SectionCard, Field } from '../../components/DetailSection';

export default function RtlTruckDetailPage() {
  const { id } = useParams();
  const { item: truck, loading, error } = useRtlTruck(id);

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  if (error || !truck) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>RTL truck not found.</span>
        <Link to="/rtl" className="btn btn-sm btn-outline-secondary">Back to RTL</Link>
      </div>
    );
  }

  const status = truck.latest_status;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <Link to="/rtl" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0">{truck.name}</h5>
          <span className={`badge bg-${truck.active ? 'success' : 'secondary'}`}>
            {truck.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <SectionCard title="Truck Info" icon="bi-truck">
        <Field label="Name">{truck.name}</Field>
        <Field label="VIN">{truck.vin}</Field>
        <Field label="Year">{truck.year}</Field>
        <Field label="Make">{truck.make}</Field>
        <Field label="Model">{truck.model}</Field>
        <Field label="Plate Number">{truck.plate_number}</Field>
        <Field label="ELD Serial">{truck.eld_serial_number}</Field>
      </SectionCard>

      <SectionCard title="GPS / Telematics" icon="bi-geo-alt">
        {status ? (
          <>
            <Field label="Speed">
              {status.speed != null ? `${Math.round(status.speed)} mph` : null}
            </Field>
            <Field label="Odometer">
              {status.odometer != null ? `${Number(status.odometer).toLocaleString()} mi` : null}
            </Field>
            <Field label="Latitude">{status.lat}</Field>
            <Field label="Longitude">{status.lon}</Field>
            <Field label="Location">{status.calculated_location}</Field>
            <Field label="Timestamp">{status.timestamp}</Field>
            <Field label="VIN">{status.vin}</Field>
            <Field label="Synced At">{status.synced_at}</Field>
          </>
        ) : (
          <div className="col-12 text-muted">No GPS status available.</div>
        )}
      </SectionCard>

      <SectionCard title="Sync Info" icon="bi-arrow-repeat">
        <Field label="RTL ID">{truck.rtl_id}</Field>
        <Field label="Company ID">{truck.company_id}</Field>
        <Field label="Synced At">{truck.synced_at}</Field>
      </SectionCard>
    </div>
  );
}
