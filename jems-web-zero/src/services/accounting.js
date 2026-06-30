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
  list:   (params) => api.get('/accounting/accounts/', { params }),
  get:    (id)     => api.get(`/accounting/accounts/${id}/`),
  create: (data)   => api.post('/accounting/accounts/', data),
  update: (id, data) => api.patch(`/accounting/accounts/${id}/`, data),
};

export const categoriesService = {
  list: (params) => api.get('/accounting/categories/', { params }),
};

export const recordsService = {
  list:    (params)      => api.get('/accounting/records/', { params }),
  get:     (id)          => api.get(`/accounting/records/${id}/`),
  create:  (data)        => api.post('/accounting/records/', data),
  update:  (id, data)    => api.patch(`/accounting/records/${id}/`, data),
  destroy: (id)          => api.delete(`/accounting/records/${id}/`),
};

export const driverInvoicesService = {
  list:     (params)   => api.get('/accounting/driver-invoices/', { params }),
  get:      (id)       => api.get(`/accounting/driver-invoices/${id}/`),
  create:   (data)     => api.post('/accounting/driver-invoices/', data),
  update:   (id, data) => api.patch(`/accounting/driver-invoices/${id}/`, data),
  destroy:  (id)       => api.delete(`/accounting/driver-invoices/${id}/`),
  close:    (id)       => api.post(`/accounting/driver-invoices/${id}/close/`),
  open:     (id)       => api.post(`/accounting/driver-invoices/${id}/open/`),
  analysis: (params)   => api.get('/accounting/driver-invoices/analysis/', { params }),
};

export const ownerInvoicesService = {
  list:    (params)   => api.get('/accounting/owner-invoices/', { params }),
  get:     (id)       => api.get(`/accounting/owner-invoices/${id}/`),
  create:  (data)     => api.post('/accounting/owner-invoices/', data),
  update:  (id, data) => api.patch(`/accounting/owner-invoices/${id}/`, data),
  destroy: (id)       => api.delete(`/accounting/owner-invoices/${id}/`),
  close:   (id)       => api.post(`/accounting/owner-invoices/${id}/close/`),
  open:    (id)       => api.post(`/accounting/owner-invoices/${id}/open/`),
};
