import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useLoad } from '../../hooks/useLoad';
import { useOptions } from '../../hooks/useOptions';
import { loadsService, LOAD_STATUS } from '../../services/loads';
import { utcIsoToEtDisplay } from '../../utils/dates';
import { SectionCard, Field, YesNo, Money } from '../../components/DetailSection';
import { mediaUrl } from '../../utils/media';

function StatusBadge({ status }) {
  const s = LOAD_STATUS[status] || { label: status, cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

function Stars({ value }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className="text-warning">
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= value ? 'bi-star-fill' : 'bi-star'}`} />
      ))}
    </span>
  );
}

function FileLink({ label, value }) {
  const url = mediaUrl(value);
  return (
    <div className="col-sm-6 col-lg-3 mb-2">
      <div className="text-muted small">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-decoration-none">
          <i className="bi bi-file-earmark-arrow-down me-1" />Download
        </a>
      ) : (
        <span className="text-muted">—</span>
      )}
    </div>
  );
}

export default function LoadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { load, loading, error, refresh } = useLoad(id);
  const trailerTypes = useOptions('/fleet/trailer-types/');
  const [actioning, setActioning] = useState(false);

  const runAction = async (fn, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActioning(true);
    try {
      await fn();
      refresh();
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  if (error || !load) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>Load not found.</span>
        <Link to="/loads" className="btn btn-sm btn-outline-secondary">Back to Loads</Link>
      </div>
    );
  }

  const trailerType = trailerTypes.find((t) => t.id === load.trailer_type);

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div className="d-flex align-items-center gap-3">
          <Link to="/loads" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0">
            <i className="bi bi-box-seam me-2" />Load {load.number}
          </h5>
          <StatusBadge status={load.status} />
          <span className="fs-5 fw-semibold text-success">
            <Money value={load.payment} />
          </span>
        </div>
        <div className="d-flex gap-1 flex-wrap">
          <Link to={`/loads/${load.id}/edit`} className="btn btn-sm btn-outline-primary">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button
            className={`btn btn-sm ${load.invoiced ? 'btn-success' : 'btn-outline-success'}`}
            disabled={actioning}
            onClick={() => runAction(() => loadsService.toggleInvoiced(load.id))}
          >
            <i className="bi bi-receipt me-1" />{load.invoiced ? 'Invoiced' : 'Mark Invoiced'}
          </button>
          <button
            className={`btn btn-sm ${load.paid ? 'btn-success' : 'btn-outline-success'}`}
            disabled={actioning}
            onClick={() => runAction(() => loadsService.togglePaid(load.id))}
          >
            <i className="bi bi-cash-coin me-1" />{load.paid ? 'Paid' : 'Mark Paid'}
          </button>
          <div className="dropdown">
            <button
              className="btn btn-sm btn-outline-dark dropdown-toggle"
              data-bs-toggle="dropdown"
              disabled={actioning}
            >
              Status
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              {load.status !== 3 && (
                <li>
                  <button className="dropdown-item" onClick={() => runAction(() => loadsService.setStatus(load.id, 3), 'Mark as Delivered?')}>
                    <i className="bi bi-check-circle me-1 text-success" />Delivered
                  </button>
                </li>
              )}
              {load.status !== 4 && (
                <li>
                  <button className="dropdown-item" onClick={() => runAction(() => loadsService.setStatus(load.id, 4), 'Mark as Detention?')}>
                    <i className="bi bi-pause-circle me-1 text-warning" />Mark as Detention
                  </button>
                </li>
              )}
              {load.status === 1 && (
                <li>
                  <button className="dropdown-item text-danger" onClick={() => runAction(() => loadsService.setStatus(load.id, 5), 'Cancel this load?')}>
                    <i className="bi bi-x-circle me-1" />Cancel Load
                  </button>
                </li>
              )}
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button
                  className="dropdown-item"
                  onClick={() => runAction(async () => { await loadsService.setHistory(load.id); navigate('/loads'); }, 'Move this load to history?')}
                >
                  <i className="bi bi-archive me-1" />Move to History
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Route */}
      <SectionCard title="Route" icon="bi-signpost-split">
        <Field label="Pick Up">
          {load.pickup_city_display || '—'}
          {load.pickup_address && <div className="small text-muted">{load.pickup_address}</div>}
          {load.pickup_date && <div className="small">{utcIsoToEtDisplay(load.pickup_date)}</div>}
        </Field>
        <Field label="Drop Off">
          {load.dropoff_city_display || '—'}
          {load.dropoff_address && <div className="small text-muted">{load.dropoff_address}</div>}
          {load.dropoff_date && <div className="small">{utcIsoToEtDisplay(load.dropoff_date)}</div>}
        </Field>
        <Field label="Miles">{load.miles ?? '—'}{load.miles_empty ? <span className="text-muted small"> (+{load.miles_empty} empty)</span> : null}</Field>
        <Field label="Weight">{load.weight ? `${Number(load.weight).toLocaleString()} lb` : '—'}</Field>
        <Field label="Trailer Type">{trailerType ? `${trailerType.name} (${trailerType.short_name})` : load.trailer_type ?? '—'}</Field>
        <Field label="Drop Trailer"><YesNo value={load.drop_trailer} /></Field>
      </SectionCard>

      {/* Parties */}
      <SectionCard title="Broker & Parties" icon="bi-building">
        <Field label="Broker">{load.broker_name}</Field>
        <Field label="Carrier">{load.carrier_name}</Field>
        <Field label="Dispatcher">{load.dispatcher ? `#${load.dispatcher}` : null}</Field>
        <Field label="Shipper">{load.shipper_name}</Field>
        <Field label="Receiver">{load.receiver_name}</Field>
      </SectionCard>

      {/* Assignment */}
      <SectionCard title="Assignment" icon="bi-truck">
        <Field label="Driver">{load.driver ? `Driver #${load.driver}` : <span className="text-muted">Unassigned</span>}</Field>
        <Field label="Team Driver">{load.team_driver ? `Driver #${load.team_driver}` : null}</Field>
        <Field label="Truck">{load.truck ? `Truck #${load.truck}` : null}</Field>
        <Field label="Trailer">{load.trailer ? `Trailer #${load.trailer}` : null}</Field>
      </SectionCard>

      {/* Financials */}
      <SectionCard title="Financials" icon="bi-cash-stack">
        <Field label="Payment"><Money value={load.payment} /></Field>
        <Field label="Detention"><Money value={load.detention} /></Field>
        <Field label="Lumper">
          <Money value={load.lumper} />
          {load.lumper_paid_by && <span className="text-muted small"> ({load.lumper_paid_by})</span>}
        </Field>
        <Field label="Invoiced"><YesNo value={load.invoiced} /></Field>
        <Field label="Paid"><YesNo value={load.paid} /></Field>
        <Field label="Owner Invoiced"><YesNo value={load.owner_invoiced} /></Field>
        <Field label="Owner Paid"><YesNo value={load.owner_paid} /></Field>
      </SectionCard>

      {/* Ratings */}
      <SectionCard title="Ratings" icon="bi-star">
        <Field label="Shipper Rating"><Stars value={load.shipper_rating} /></Field>
        <Field label="Receiver Rating"><Stars value={load.receiver_rating} /></Field>
      </SectionCard>

      {/* Documents */}
      <SectionCard title="Documents" icon="bi-paperclip">
        <FileLink label="Rate Confirmation" value={load.rate_file} />
        <FileLink label="Bill of Lading" value={load.bill_file} />
        <FileLink label="Lumper Receipt" value={load.lumper_file} />
        <FileLink label="Detention" value={load.detention_file} />
      </SectionCard>

      {/* Notes */}
      {load.details && (
        <SectionCard title="Details" icon="bi-card-text">
          <div className="col-12" style={{ whiteSpace: 'pre-wrap' }}>{load.details}</div>
        </SectionCard>
      )}

      {/* Stops */}
      {Array.isArray(load.stops) && load.stops.length > 0 && (
        <div className="card mb-3">
          <div className="card-header py-2 bg-light">
            <span className="fw-semibold"><i className="bi bi-geo-alt me-2" />Stops</span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Type</th>
                  <th>City</th>
                  <th>Address</th>
                  <th>From</th>
                  <th>To</th>
                  <th>PO #</th>
                  <th>Commodity</th>
                </tr>
              </thead>
              <tbody>
                {load.stops.map((s) => (
                  <tr key={s.id}>
                    <td>{s.stop_type}</td>
                    <td>{s.city ?? '—'}</td>
                    <td>{s.address ?? '—'}</td>
                    <td>{s.from_date ? utcIsoToEtDisplay(s.from_date) : '—'}</td>
                    <td>{s.to_date ? utcIsoToEtDisplay(s.to_date) : '—'}</td>
                    <td>{s.po_number ?? '—'}</td>
                    <td>{s.commodity ?? '—'}</td>
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
