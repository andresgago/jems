import api from './api';

export const trailerMaintenanceService = {
  list:       (params) => api.get('/fleet/trailer-maintenance/', { params }),
  get:        (id)     => api.get(`/fleet/trailer-maintenance/${id}/`),
  create:     (data)   => api.post('/fleet/trailer-maintenance/', data),
  update:     (id, data) => api.patch(`/fleet/trailer-maintenance/${id}/`, data),
  destroy:    (id)     => api.delete(`/fleet/trailer-maintenance/${id}/`),
  bulkDelete: (ids)    => api.post('/fleet/trailer-maintenance/bulk-delete/', { ids }),
  alertInfo:  (id)     => api.get(`/fleet/trailer-maintenance/${id}/alert-info/`),
  // Nested under trailer (legacy compat — for trailer detail page)
  listForTrailer: (trailerId) => api.get(`/fleet/trailers/${trailerId}/maintenance/`),
  addForTrailer:  (trailerId, data) => api.post(`/fleet/trailers/${trailerId}/maintenance/`, data),
};
