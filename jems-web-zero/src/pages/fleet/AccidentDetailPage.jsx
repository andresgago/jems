import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SectionCard, Field, YesNo } from '../../components/DetailSection';
import { accidentsService, ACCIDENT_FILE_SLOTS } from '../../services/accidents';
import { useAccident } from '../../hooks/useAccident';
import { mediaUrl } from '../../utils/media';

const FILE_LABELS = {
  police_report: 'Police Report',
  post_accident: 'Post Accident',
};

const FILE_FIELDS = {
  police_report: 'police_report_file',
  post_accident: 'post_accident_file',
};

function AccidentFiles({ accident, onRefresh }) {
  const [uploading, setUploading] = useState({});
  const refs = useRef({});

  const handleUpload = async (slot, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading((prev) => ({ ...prev, [slot]: true }));
    try {
      await accidentsService.uploadFile(accident.id, slot, file);
      onRefresh();
    } finally {
      setUploading((prev) => ({ ...prev, [slot]: false }));
      if (refs.current[slot]) refs.current[slot].value = '';
    }
  };

  const handleClear = async (slot) => {
    if (!window.confirm(`Remove ${FILE_LABELS[slot]}?`)) return;
    await accidentsService.clearFile(accident.id, slot);
    onRefresh();
  };

  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold"><i className="bi bi-file-earmark-text me-2" />Documents</span>
      </div>
      <div className="card-body p-0">
        <table className="table table-sm mb-0">
          <thead className="table-light">
            <tr>
              <th>Document</th>
              <th>File</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ACCIDENT_FILE_SLOTS.map((slot) => {
              const url = mediaUrl(accident[FILE_FIELDS[slot]]);
              return (
                <tr key={slot}>
                  <td className="align-middle fw-semibold">{FILE_LABELS[slot]}</td>
                  <td className="align-middle">
                    {url
                      ? (
                        <a href={url} target="_blank" rel="noreferrer" className="text-decoration-none small">
                          <i className="bi bi-file-earmark-arrow-down me-1" />Download
                        </a>
                      )
                      : <span className="text-muted small">Not uploaded</span>}
                  </td>
                  <td className="text-center align-middle">
                    <div className="d-flex gap-1 justify-content-center">
                      <label className="btn btn-sm btn-outline-secondary py-0" title={url ? 'Replace' : 'Upload'}>
                        <i className={`bi ${url ? 'bi-arrow-repeat' : 'bi-upload'}`} />
                        <input
                          ref={(el) => { refs.current[slot] = el; }}
                          type="file"
                          className="d-none"
                          onChange={(e) => handleUpload(slot, e)}
                          disabled={uploading[slot]}
                        />
                      </label>
                      {url && (
                        <button
                          className="btn btn-sm btn-outline-danger py-0"
                          title="Remove"
                          onClick={() => handleClear(slot)}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                    </div>
                    {uploading[slot] && <small className="text-muted d-block mt-1">Uploading…</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PictureGallery({ accident, onRefresh }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await accidentsService.addPicture(accident.id, file);
      onRefresh();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (pictureId) => {
    if (!window.confirm('Remove this picture?')) return;
    await accidentsService.deletePicture(accident.id, pictureId);
    onRefresh();
  };

  const pictures = accident.pictures ?? [];

  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold"><i className="bi bi-images me-2" />Pictures</span>
      </div>
      <div className="card-body">
        {pictures.length === 0 && <p className="text-muted small mb-0">No pictures uploaded.</p>}
        <div className="row g-2">
          {pictures.map((p) => (
            <div key={p.id} className="col-6 col-md-3">
              <div className="position-relative">
                <img
                  src={mediaUrl(p.file) || p.file}
                  alt={p.description || 'Accident picture'}
                  className="img-fluid rounded"
                />
                <button
                  className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 py-0"
                  onClick={() => handleDelete(p.id)}
                  title="Remove"
                >
                  <i className="bi bi-x" />
                </button>
              </div>
              {p.description && <p className="small text-muted mt-1 mb-0">{p.description}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="btn btn-sm btn-outline-primary">
            <i className="bi bi-plus-lg me-1" />Add Picture
            <input type="file" accept="image/*" className="d-none" onChange={handleUpload} disabled={uploading} />
          </label>
          {uploading && <span className="ms-2 text-muted small">Uploading…</span>}
        </div>
      </div>
    </div>
  );
}

export default function AccidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accident, loading, error, refresh } = useAccident(id);

  const handleDelete = async () => {
    if (!window.confirm('Delete this accident record?')) return;
    await accidentsService.destroy(id);
    navigate('/fleet/accidents');
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (error || !accident) return <div className="alert alert-danger">Accident not found.</div>;

  const dateStr = accident.date ? new Date(accident.date).toLocaleString() : '—';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <Link to="/fleet/accidents" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0">
            <i className="bi bi-exclamation-triangle me-2" />Accident #{accident.id}
          </h5>
        </div>
        <div className="d-flex gap-2">
          <Link to={`/fleet/accidents/${id}/edit`} className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
          <button className="btn btn-sm btn-outline-danger" onClick={handleDelete}>
            <i className="bi bi-trash me-1" />Delete
          </button>
        </div>
      </div>

      <SectionCard title="Accident Info" icon="bi-exclamation-triangle">
        <Field label="FMCSA Crash Report #">{accident.crash_number || '—'}</Field>
        <Field label="Date">{dateStr}</Field>
        <Field label="Driver">{accident.driver_name || '—'}</Field>
        <Field label="Truck">{accident.truck_number || '—'}</Field>
        <Field label="Trailer">{accident.trailer_number || '—'}</Field>
        <Field label="Address">{accident.address || '—'}</Field>
        <Field label="City">{accident.city_name || '—'}</Field>
        <Field label="State">{accident.state_name || '—'}</Field>
      </SectionCard>

      <SectionCard title="FMCSA Info" icon="bi-clipboard-data">
        <Field label="Tow-aways"><YesNo value={accident.tow_aways} /></Field>
        <Field label="Deaths">{accident.death_count ?? 0}</Field>
        <Field label="Fatal Injuries">{accident.fatal_injuries ?? 0}</Field>
      </SectionCard>

      <AccidentFiles accident={accident} onRefresh={refresh} />

      <PictureGallery accident={accident} onRefresh={refresh} />
    </div>
  );
}
