import api from './api';

export const milesResetService = {
  list:    (params) => api.get('/fleet/miles-resets/', { params }),
  create:  (data)   => api.post('/fleet/miles-resets/', data),
  destroy: (id)     => api.delete(`/fleet/miles-resets/${id}/`),
};
