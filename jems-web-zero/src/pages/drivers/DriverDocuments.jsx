import { useRef, useState } from 'react';
import { driversService, DOCUMENT_TYPES } from '../../services/drivers';
import { mediaUrl } from '../../utils/media';

export default function DriverDocuments({ driverId, documents, onChange }) {
  const fileRef = useRef(null);
  const [docType, setDocType] = useState('1');
  const [expiration, setExpiration] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await driversService.uploadDocument(driverId, {
        document_type: docType,
        file,
        expiration_date: expiration || null,
      });
      setFile(null);
      setExpiration('');
      if (fileRef.current) fileRef.current.value = '';
      onChange();
    } catch {
      setError('Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    setBusy(true);
    try {
      await driversService.deleteDocument(docId);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold"><i className="bi bi-paperclip me-2" />Documents</span>
      </div>
      <div className="card-body">
        {/* Upload form */}
        <form className="row g-2 align-items-end mb-3" onSubmit={handleUpload}>
          <div className="col-auto">
            <label className="form-label form-label-sm mb-1">Type</label>
            <select className="form-select form-select-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label form-label-sm mb-1">File</label>
            <input
              ref={fileRef}
              type="file"
              className="form-control form-control-sm"
              aria-label="Document file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label form-label-sm mb-1">Expiration</label>
            <input type="date" className="form-control form-control-sm" value={expiration} onChange={(e) => setExpiration(e.target.value)} />
          </div>
          <div className="col-auto">
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
              <i className="bi bi-upload me-1" />Upload
            </button>
          </div>
        </form>
        {error && <div className="alert alert-danger py-1 small mb-3">{error}</div>}

        {/* List */}
        {(!documents || documents.length === 0) ? (
          <p className="text-muted small mb-0">No documents uploaded.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr><th>Type</th><th>Expiration</th><th>File</th><th className="text-center">Actions</th></tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.document_type_display}</td>
                    <td>{doc.expiration_date ?? '—'}</td>
                    <td>
                      {doc.file ? (
                        <a href={mediaUrl(doc.file)} target="_blank" rel="noreferrer" className="text-decoration-none">
                          <i className="bi bi-file-earmark-arrow-down me-1" />Download
                        </a>
                      ) : '—'}
                    </td>
                    <td className="text-center">
                      <button className="btn btn-sm btn-outline-danger py-0" title="Delete" disabled={busy} onClick={() => handleDelete(doc.id)}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
