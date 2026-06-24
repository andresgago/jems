import api from './api';

export const RECORD_TYPE = {
  1: { label: 'Income', cls: 'success' },
  2: { label: 'Expense', cls: 'danger' },
  3: { label: 'Transfer', cls: 'info' },
};

export const DRIVER_INVOICE_STATUS = {
  0: { label: 'Closed', cls: 'secondary' },
  1: { label: 'Open', cls: 'success' },
};

export const OWNER_INVOICE_STATUS = {
  0: { label: 'Closed', cls: 'secondary' },
  1: { label: 'Open', cls: 'success' },
};

export const accountsService = {
  list:   (params) => api.get('/accounts/', { params }),
  get:    (id)     => api.get(`/accounts/${id}/`),
  create: (data)   => api.post('/accounts/', data),
  update: (id, data) => api.patch(`/accounts/${id}/`, data),
};

export const categoriesService = {
  list: (params) => api.get('/categories/', { params }),
};

export const recordsService = {
  list:    (params)      => api.get('/records/', { params }),
  get:     (id)          => api.get(`/records/${id}/`),
  create:  (data)        => api.post('/records/', data),
  update:  (id, data)    => api.patch(`/records/${id}/`, data),
  destroy: (id)          => api.delete(`/records/${id}/`),
};

export const driverInvoicesService = {
  list:    (params)   => api.get('/driver-invoices/', { params }),
  get:     (id)       => api.get(`/driver-invoices/${id}/`),
  create:  (data)     => api.post('/driver-invoices/', data),
  update:  (id, data) => api.patch(`/driver-invoices/${id}/`, data),
  destroy: (id)       => api.delete(`/driver-invoices/${id}/`),
  close:   (id)       => api.post(`/driver-invoices/${id}/close/`),
  open:    (id)       => api.post(`/driver-invoices/${id}/open/`),
};

export const ownerInvoicesService = {
  list:    (params)   => api.get('/owner-invoices/', { params }),
  get:     (id)       => api.get(`/owner-invoices/${id}/`),
  create:  (data)     => api.post('/owner-invoices/', data),
  update:  (id, data) => api.patch(`/owner-invoices/${id}/`, data),
  destroy: (id)       => api.delete(`/owner-invoices/${id}/`),
  close:   (id)       => api.post(`/owner-invoices/${id}/close/`),
  open:    (id)       => api.post(`/owner-invoices/${id}/open/`),
};
