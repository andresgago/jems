import api from './api';

export const milesResetService = {
  list:       (params) => api.get('/fleet/miles-resets/', { params }),
  get:        (id) => api.get(`/fleet/miles-resets/${id}/`),
  create:     (data) => api.post('/fleet/miles-resets/', data),
  update:     (id, data) => api.patch(`/fleet/miles-resets/${id}/`, data),
  destroy:    (id) => api.delete(`/fleet/miles-resets/${id}/`),
  bulkDelete: (ids) => api.post('/fleet/miles-resets/bulk-delete/', { ids }),
};
