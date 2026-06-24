import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCity } from '../../hooks/useCity';
import { citiesService, CITY_STATUS } from '../../services/cities';
import { SectionCard, Field } from '../../components/DetailSection';

function StatusBadge({ active }) {
  const s = CITY_STATUS[active] || CITY_STATUS[String(active)] || { label: String(active), cls: 'secondary' };
  return <span className={`badge bg-${s.cls}`}>{s.label}</span>;
}

export default function CityDetailPage() {
  const { id } = useParams();
  const { city, loading, error, reload } = useCity(id);
  const [actioning, setActioning] = useState(false);

  const toggleStatus = async () => {
    if (!window.confirm('Toggle status for this city?')) return;
    setActioning(true);
    try {
      await citiesService.toggleStatus(city.id);
      reload();
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }

  if (error || !city) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center">
        <span>City not found.</span>
        <Link to="/settings/cities" className="btn btn-sm btn-outline-secondary">Back to Cities</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <Link to="/settings/cities" className="text-decoration-none text-muted small">
            <i className="bi bi-arrow-left me-1" />Cities
          </Link>
          <h4 className="mb-0 mt-1">{city.name}, {city.state_abbreviation} {city.zip}</h4>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-warning"
            onClick={toggleStatus}
            disabled={actioning}
          >
            {actioning ? <span className="spinner-border spinner-border-sm" /> : (
              <><i className="bi bi-toggle-on me-1" />Toggle Status</>
            )}
          </button>
          <Link to={`/settings/cities/${city.id}/edit`} className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-pencil me-1" />Edit
          </Link>
        </div>
      </div>

      <SectionCard title="City Information" icon="bi-geo-alt">
        <Field label="Name">{city.name}</Field>
        <Field label="Zip Code">{city.zip}</Field>
        <Field label="State">
          {city.state_data
            ? `${city.state_data.name} (${city.state_data.abbreviation})`
            : <span className="text-muted">—</span>}
        </Field>
        <Field label="Timezone">{city.timezone || <span className="text-muted">—</span>}</Field>
        <Field label="Status"><StatusBadge active={city.active} /></Field>
      </SectionCard>
    </div>
  );
}
