import api from './api';

export const truckMaintenanceService = {
  list:       (params) => api.get('/fleet/truck-maintenance/', { params }),
  get:        (id)     => api.get(`/fleet/truck-maintenance/${id}/`),
  create:     (data)   => api.post('/fleet/truck-maintenance/', data),
  update:     (id, data) => api.patch(`/fleet/truck-maintenance/${id}/`, data),
  destroy:    (id)     => api.delete(`/fleet/truck-maintenance/${id}/`),
  bulkDelete: (ids)    => api.post('/fleet/truck-maintenance/bulk-delete/', { ids }),
  alertInfo:  (id)     => api.get(`/fleet/truck-maintenance/${id}/alert-info/`),
  // Nested under truck (legacy compat — for truck detail page)
  listForTruck: (truckId) => api.get(`/fleet/trucks/${truckId}/maintenance/`),
  addForTruck:  (truckId, data) => api.post(`/fleet/trucks/${truckId}/maintenance/`, data),
};
