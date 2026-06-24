export function SectionCard({ title, icon, children }) {
  return (
    <div className="card mb-3">
      <div className="card-header py-2 bg-light">
        <span className="fw-semibold">
          {icon && <i className={`bi ${icon} me-2`} />}{title}
        </span>
      </div>
      <div className="card-body">
        <div className="row">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="col-sm-6 col-lg-4 mb-2">
      <div className="text-muted small">{label}</div>
      <div>{children ?? <span className="text-muted">—</span>}</div>
    </div>
  );
}

export function YesNo({ value }) {
  return value ? (
    <span className="badge bg-success-subtle text-success-emphasis">Yes</span>
  ) : (
    <span className="badge bg-secondary-subtle text-secondary-emphasis">No</span>
  );
}

export function Money({ value }) {
  if (value == null || value === '') return <span className="text-muted">—</span>;
  return <>${Number(value).toLocaleString()}</>;
}
