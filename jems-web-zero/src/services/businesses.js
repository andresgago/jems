import api from './api'

export const BUSINESS_STATUS = {
  1: { label: 'Active', cls: 'success' },
  0: { label: 'Inactive', cls: 'secondary' },
}

export const businessesService = {
  list: (params) => api.get('/brokers/business/', { params }),
  get: (id) => api.get(`/brokers/business/${id}/`),
  search: (q) => api.get(`/brokers/business/search/?q=${encodeURIComponent(q)}`),
  create: (data) => api.post('/brokers/business/', data),
  update: (id, data) => api.patch(`/brokers/business/${id}/`, data),
  destroy: (id) => api.delete(`/brokers/business/${id}/`),
  toggleStatus: (id) => api.post(`/brokers/business/${id}/toggle-status/`),
}
