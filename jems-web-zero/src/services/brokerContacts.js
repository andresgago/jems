import api from './api'

export const brokerContactsService = {
  list: (params) => api.get('/brokers/contacts/', { params }),
  get: (id) => api.get(`/brokers/contacts/${id}/`),
  create: (data) => api.post('/brokers/contacts/', data),
  update: (id, data) => api.patch(`/brokers/contacts/${id}/`, data),
  destroy: (id) => api.delete(`/brokers/contacts/${id}/`),
}
