import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { categoriesService } from '../../services/accounting';
import { SectionCard, Field, YesNo } from '../../components/DetailSection';

function PhotoSection({ photo }) {
  if (!photo) {
    return (
      <div className="text-center py-4 text-muted">
        <i className="bi bi-image" style={{ fontSize: '3rem' }} />
        <div className="small mt-1">No photo</div>
      </div>
    );
  }
  return (
    <div className="text-center p-2">
      <img
        src={photo}
        alt="Category"
        style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', borderRadius: 6 }}
      />
    </div>
  );
}

export default function CategoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    categoriesService.get(id)
      .then((r) => setCategory(r.data))
      .catch(() => setError('Category not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      const r = await categoriesService.toggleStatus(id);
      setCategory(r.data);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete category "${category.code} - ${category.name}"?`)) return;
    try {
      await categoriesService.destroy(id);
      navigate('/accounting/categories');
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete: this category has linked records.');
    }
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>;
  if (error || !category) return <div className="alert alert-danger">{error || 'Not found.'}</div>;

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link to="/accounting/categories" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1" />Categories
        </Link>
        <h5 className="mb-0 ms-1">
          <i className="bi bi-tag me-2" />{category.code} — {category.name}
        </h5>
        <div className="ms-auto d-flex gap-2">
          <button
            className={`btn btn-sm ${category.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
            onClick={handleToggleStatus}
            disabled={toggling}
          >
            <i className={`bi ${category.is_active ? 'bi-toggle-off' : 'bi-toggle-on'} me-1`} />
            {category.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <Link to={`/accounting/categories/${id}/edit`} className="btn btn-sm btn-primary">
            <i className="bi bi-pencil-fill me-1" />Edit
          </Link>
          <button className="btn btn-sm btn-danger" onClick={handleDelete}>
            <i className="bi bi-trash me-1" />Delete
          </button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-8">
          <SectionCard title="Category Info" icon="bi-tag">
            <div className="row g-3">
              <div className="col-md-4"><Field label="Code">{category.code}</Field></div>
              <div className="col-md-8"><Field label="Name">{category.name}</Field></div>
              <div className="col-md-6">
                <Field label="Type">{category.category_type_name || '—'}</Field>
              </div>
              <div className="col-md-6">
                <Field label="Unit of Measure">{category.unit_of_measure || '—'}</Field>
              </div>
              <div className="col-md-4">
                <Field label="Truck Part"><YesNo value={category.is_truck_part} /></Field>
              </div>
              <div className="col-md-4">
                <Field label="Status">
                  {category.is_active
                    ? <span className="badge bg-success">Active</span>
                    : <span className="badge bg-secondary">Inactive</span>}
                </Field>
              </div>
            </div>
          </SectionCard>

          {category.is_truck_part && (
            <SectionCard title="Truck Part Details" icon="bi-tools">
              <div className="row g-3">
                <div className="col-md-4">
                  <Field label="Engine">{category.engine_type_name || '—'}</Field>
                </div>
                <div className="col-md-4">
                  <Field label="Cabin / Model">{category.cabin_type_name || '—'}</Field>
                </div>
                <div className="col-md-4">
                  <Field label="Transmission">{category.transmission_type_name || '—'}</Field>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="col-md-4">
          <SectionCard title="Photo" icon="bi-image">
            <PhotoSection photo={category.photo} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
