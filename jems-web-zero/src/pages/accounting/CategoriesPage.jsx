import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { categoriesService } from '../../services/accounting';
import api from '../../services/api';

function PhotoCell({ photo }) {
  if (!photo) {
    return (
      <div className="d-flex justify-content-center">
        <i className="bi bi-image text-muted" style={{ fontSize: '1.2rem' }} />
      </div>
    );
  }
  const src = photo.startsWith('http') ? photo : `${api.defaults.baseURL?.replace('/api/v1', '') || ''}/media/${photo}`;
  return (
    <div className="d-flex justify-content-center">
      <img
        src={src}
        alt="category"
        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
      />
    </div>
  );
}

function StatusToggle({ isActive, onToggle, loading }) {
  return (
    <button
      className={`btn btn-sm btn-link p-0 ${isActive ? 'text-success' : 'text-secondary'}`}
      title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
      onClick={onToggle}
      disabled={loading}
    >
      <i className={`bi ${isActive ? 'bi-toggle-on' : 'bi-toggle-off'}`} style={{ fontSize: '1.3rem' }} />
    </button>
  );
}

function CategoryRow({ category, serialNo, selected, onToggleSelect, onToggled, onDeleted }) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await categoriesService.toggleStatus(category.id);
      onToggled();
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete category "${category.code} - ${category.name}"?`)) return;
    setDeleting(true);
    try {
      await categoriesService.destroy(category.id);
      onDeleted();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Cannot delete: this category has linked records.';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  const rowClass = category.is_active ? '' : 'text-muted';

  return (
    <tr className={rowClass} style={category.is_active ? {} : { opacity: 0.55 }}>
      <td className="text-center">
        <input
          type="checkbox"
          className="form-check-input"
          checked={selected}
          onChange={() => onToggleSelect(category.id)}
          title="Select"
        />
      </td>
      <td className="text-center text-muted small">{serialNo}</td>
      <td className="text-center"><PhotoCell photo={category.photo} /></td>
      <td className="text-center fw-semibold" style={{ width: 180 }}>{category.code}</td>
      <td style={{ minWidth: 200 }}>{category.name}</td>
      <td className="text-center small">{category.category_type_name || '—'}</td>
      <td className="text-center">
        {category.is_truck_part
          ? <span className="badge bg-primary">Yes</span>
          : <span className="text-muted small">Not</span>}
      </td>
      <td className="text-center small text-muted">{category.unit_of_measure || '—'}</td>
      <td className="text-center">
        <div className="d-flex gap-1 justify-content-center">
          <Link
            to={`/accounting/categories/${category.id}`}
            className="btn btn-sm btn-link p-0 text-info"
            title="View"
          >
            <i className="bi bi-eye" />
          </Link>
          <Link
            to={`/accounting/categories/${category.id}/edit`}
            className="btn btn-sm btn-link p-0"
            title="Edit"
          >
            <i className="bi bi-pencil-fill" />
          </Link>
          <button
            className="btn btn-sm btn-link p-0 text-danger"
            title="Delete"
            disabled={deleting}
            onClick={handleDelete}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      </td>
      <td className="text-center">
        <StatusToggle isActive={category.is_active} onToggle={handleToggle} loading={toggling} />
      </td>
    </tr>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Inline filters (instant, client-side)
  const [codeFilter, setCodeFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [truckPartFilter, setTruckPartFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const res = await categoriesService.list();
      setCategories(res.data);
    } catch {
      setError('Error loading categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/accounting/category-types/')
      .then((r) => setCategoryTypes(r.data))
      .catch(() => {});
  }, [load]);

  const handleReset = () => {
    setCodeFilter('');
    setNameFilter('');
    setTypeFilter('');
    setTruckPartFilter('');
  };

  const filtered = useMemo(() => {
    let result = categories;
    if (codeFilter.trim()) result = result.filter((c) => c.code.toLowerCase().includes(codeFilter.toLowerCase()));
    if (nameFilter.trim()) result = result.filter((c) => c.name.toLowerCase().includes(nameFilter.toLowerCase()));
    if (typeFilter) result = result.filter((c) => String(c.category_type) === typeFilter);
    if (truckPartFilter !== '') result = result.filter((c) => (truckPartFilter === '1') === c.is_truck_part);
    return result;
  }, [categories, codeFilter, nameFilter, typeFilter, truckPartFilter]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected category(ies)?`)) return;
    setBulkDeleting(true);
    try {
      const res = await categoriesService.bulkDelete(Array.from(selectedIds));
      const data = res.data;
      if (data.blocked?.length) {
        alert(
          `Deleted ${data.deleted.length} item(s). ${data.blocked.length} item(s) could not be deleted because they have linked records.`
        );
      }
      await load();
    } catch {
      setError('Error deleting selected categories.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const COL_COUNT = 10;

  return (
    <div>
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="card loads-grid-card">
        <div className="card-header loads-grid-heading">
          <h5 className="mb-0">
            <i className="bi bi-tags me-2" />Categories
          </h5>
          <span>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}.</span>
        </div>

        <div className="loads-grid-toolbar">
          <div className="ms-auto btn-group btn-group-sm">
            <Link
              to="/accounting/categories/create"
              className="btn btn-primary"
              aria-label="New Category"
            >
              <i className="bi bi-plus-lg me-1" />New Category
            </Link>
          </div>
        </div>

        <div className="table-responsive loads-table-wrap">
          <table className="table table-sm table-hover table-striped align-middle loads-table mb-0">
            <thead>
              <tr className="loads-filter-row">
                <th className="text-center" style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                <th className="text-center" style={{ width: 36 }}>#</th>
                <th className="text-center" style={{ width: 44 }}>
                  <i className="bi bi-image" title="Photo" />
                </th>
                <th style={{ width: 180 }}>
                  <label>Code</label>
                  <input
                    className="form-control form-control-sm"
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value)}
                    placeholder="Code"
                  />
                </th>
                <th>
                  <label>Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Name"
                  />
                </th>
                <th style={{ width: 180 }}>
                  <label>Type</label>
                  <select
                    className="form-select form-select-sm"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">Type</option>
                    {categoryTypes.filter((t) => t.is_active).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </th>
                <th className="text-center" style={{ width: 110 }}>
                  <label>Truck Part</label>
                  <select
                    className="form-select form-select-sm"
                    value={truckPartFilter}
                    onChange={(e) => setTruckPartFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="1">Yes</option>
                    <option value="0">Not</option>
                  </select>
                </th>
                <th className="text-center" style={{ width: 90 }}>Um</th>
                <th className="text-center" style={{ width: 100 }}>Actions</th>
                <th className="text-center" style={{ width: 80 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="text-center py-4 text-muted">No categories found.</td>
                </tr>
              )}
              {!loading && filtered.map((cat, idx) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  serialNo={idx + 1}
                  selected={selectedIds.has(cat.id)}
                  onToggleSelect={toggleSelectOne}
                  onToggled={load}
                  onDeleted={load}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="loads-bulk-bar">
          <span><i className="bi bi-arrow-right me-2" />With selected:</span>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            disabled={selectedIds.size === 0 || bulkDeleting}
            onClick={handleBulkDelete}
          >
            <i className="bi bi-trash me-1" />
            {bulkDeleting ? 'Deleting…' : 'Delete All'}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-muted small">({selectedIds.size} selected)</span>
          )}
          <button className="btn btn-outline-secondary btn-sm ms-auto" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </section>
    </div>
  );
}
