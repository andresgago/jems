import api from './api'

export const BROKER_STATUS = {
  1: { label: 'Active', cls: 'success' },
  0: { label: 'Inactive', cls: 'secondary' },
}

const list = () => api.get('/brokers/')
const get = (id) => api.get(`/brokers/${id}/`)
const options = () => api.get('/brokers/options/')
const search = (q) => api.get(`/brokers/search/?q=${encodeURIComponent(q)}`)
const create = (data) => api.post('/brokers/', data)
const update = (id, data) => api.patch(`/brokers/${id}/`, data)
const destroy = (id) => api.delete(`/brokers/${id}/`)
const toggleStatus = (id) => api.post(`/brokers/${id}/toggle-status/`)

const getContacts = (brokerId) => api.get(`/brokers/${brokerId}/contacts/`)
const createContact = (brokerId, data) => api.post(`/brokers/${brokerId}/contacts/`, data)
const updateContact = (brokerId, contactId, data) =>
  api.patch(`/brokers/${brokerId}/contacts/${contactId}/`, data)
const deleteContact = (brokerId, contactId) =>
  api.delete(`/brokers/${brokerId}/contacts/${contactId}/`)

const uploadFile = (brokerId, slot, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/brokers/${brokerId}/files/${slot}/`, formData, {
    headers: { 'Content-Type': undefined },
  })
}
const deleteFile = (brokerId, slot) => api.delete(`/brokers/${brokerId}/files/${slot}/`)

export const brokersService = {
  list,
  get,
  options,
  search,
  create,
  update,
  destroy,
  toggleStatus,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  uploadFile,
  deleteFile,
}
