import { useMemo, useState } from 'react';
import { useRtlIfta } from '../../hooks/useRtlIfta';

function StatusBadge({ status }) {
  const cls = status === 'READY' ? 'success' : 'warning text-dark';
  return <span className={`badge bg-${cls}`}>{status}</span>;
}

export default function IftaPage() {
  const { items, loading, error, reload } = useRtlIfta();
  const [search, setSearch] = useState('');
  const [vinFilter, setVinFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (vinFilter && r.vehicle_vin !== vinFilter) return false;
      if (q && !r.vehicle_name.toLowerCase().includes(q) && !r.vehicle_vin.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, vinFilter]);

  const uniqueVins = useMemo(() => {
    const vins = [...new Set(items.map((r) => r.vehicle_vin).filter(Boolean))];
    return vins.sort();
  }, [items]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-file-earmark-spreadsheet me-2" />IFTA Reports
        </h5>
        <button className="btn btn-sm btn-outline-secondary" onClick={reload}>
          <i className="bi bi-arrow-clockwise me-1" />Refresh
        </button>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Truck name or VIN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label form-label-sm mb-1">Vehicle</label>
              <select
                className="form-select form-select-sm"
                value={vinFilter}
                onChange={(e) => setVinFilter(e.target.value)}
              >
                <option value="">All vehicles</option>
                {uniqueVins.map((vin) => (
                  <option key={vin} value={vin}>{vin}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">Error loading IFTA reports.</div>}

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm table-hover table-striped mb-0 align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Vehicle</th>
                  <th>VIN</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="text-center">Status</th>
                  <th>Generated</th>
                  <th className="text-center">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border spinner-border-sm" /></td></tr>
                )}
                {!loading && !error && filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-4">No IFTA reports found.</td></tr>
                )}
                {!loading && filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="align-middle fw-semibold">{r.vehicle_name}</td>
                    <td className="align-middle small">{r.vehicle_vin}</td>
                    <td className="align-middle">{r.from_date}</td>
                    <td className="align-middle">{r.to_date}</td>
                    <td className="align-middle text-center"><StatusBadge status={r.status_id} /></td>
                    <td className="align-middle small">{r.time_generated}</td>
                    <td className="align-middle text-center">
                      <div className="d-flex gap-1 justify-content-center">
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline-danger py-0"
                            title="Download PDF"
                          >
                            <i className="bi bi-file-earmark-pdf" />
                          </a>
                        )}
                        {r.csv_url && (
                          <a
                            href={r.csv_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline-success py-0"
                            title="Download CSV"
                          >
                            <i className="bi bi-filetype-csv" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && filtered.length > 0 && (
                <tfoot>
                  <tr className="table-secondary">
                    <td colSpan={7} className="small text-muted ps-2">
                      {filtered.length} report{filtered.length !== 1 ? 's' : ''}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
