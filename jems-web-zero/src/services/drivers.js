import api from './api';

export const DRIVER_STATUS = {
  1: { label: 'Active', cls: 'success' },
  0: { label: 'Inactive', cls: 'secondary' },
  '-1': { label: 'Terminated', cls: 'danger' },
};

export const driversService = {
  list:         (params) => api.get('/drivers/', { params }),
  get:          (id)     => api.get(`/drivers/${id}/`),
  create:       (data)   => api.post('/drivers/', data),
  update:       (id, data) => api.put(`/drivers/${id}/`, data),
  destroy:      (id)     => api.delete(`/drivers/${id}/`),
  toggleStatus: (id)     => api.post(`/drivers/${id}/toggle-status/`),
  types:        ()       => api.get('/drivers/types/'),

  listDocuments: (id) => api.get(`/drivers/${id}/documents/`),
  uploadDocument: (id, { document_type, file, expiration_date }) => {
    const fd = new FormData();
    fd.append('document_type', document_type);
    fd.append('file', file);
    if (expiration_date) fd.append('expiration_date', expiration_date);
    // Content-Type undefined lets axios/browser set the multipart boundary.
    return api.post(`/drivers/${id}/documents/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  deleteDocument: (docId) => api.delete(`/drivers/documents/${docId}/`),

  uploadPhoto: (id, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    // Content-Type undefined lets axios/browser set the multipart boundary.
    return api.post(`/drivers/${id}/photo/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  deletePhoto: (id) => api.delete(`/drivers/${id}/photo/`),

  lastLoads: () => api.get('/drivers/last-loads/'),
};

export const DOCUMENT_TYPES = [
  { value: '1', label: 'License' },
  { value: '2', label: 'Medical Card' },
  { value: '3', label: 'MVR / Record' },
  { value: '4', label: 'Residence Card' },
  { value: '5', label: 'Application' },
  { value: '6', label: 'Lease Agreement' },
  { value: '7', label: 'Social Security Card' },
];
