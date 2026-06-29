import api from './api';

export const carriersService = {
  list: () => api.get('/carriers/'),
  get: (id) => api.get(`/carriers/${id}/`),
  options: () => api.get('/carriers/options/'),
  create: (data) => api.post('/carriers/', data),
  update: (id, data) => api.patch(`/carriers/${id}/`, data),
  destroy: (id) => api.delete(`/carriers/${id}/`),
  toggleStatus: (id) => api.post(`/carriers/${id}/toggle-status/`),

  availableFiles: (id) => api.get(`/carriers/${id}/available-files/`),

  sendPacket: (id, data) => api.post(`/carriers/${id}/send-packet/`, data),
};
