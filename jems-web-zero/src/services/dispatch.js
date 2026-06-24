import api from './api';

export const INVOICE_STATUS = {
  0: { label: 'Closed', cls: 'secondary' },
  1: { label: 'Open', cls: 'success' },
};

export const DISPATCHER_TYPE = {
  0: { label: 'None', cls: 'secondary' },
  1: { label: 'By Percent', cls: 'info' },
  2: { label: 'By Hour', cls: 'primary' },
};

export const dispatchWorkService = {
  list:     (params)      => api.get('/dispatch/work/', { params }),
  get:      (id)          => api.get(`/dispatch/work/${id}/`),
  create:   (data)        => api.post('/dispatch/work/', data),
  update:   (id, data)    => api.patch(`/dispatch/work/${id}/`, data),
  destroy:  (id)          => api.delete(`/dispatch/work/${id}/`),
  finish:   (id)          => api.post(`/dispatch/work/${id}/finish/`),
  markPaid: (id)          => api.post(`/dispatch/work/${id}/mark-paid/`),
};

export const percentInvoicesService = {
  list:    (params)      => api.get('/dispatch/invoices/percent/', { params }),
  get:     (id)          => api.get(`/dispatch/invoices/percent/${id}/`),
  create:  (data)        => api.post('/dispatch/invoices/percent/', data),
  update:  (id, data)    => api.patch(`/dispatch/invoices/percent/${id}/`, data),
  close:   (id)          => api.post(`/dispatch/invoices/percent/${id}/close/`),
  open:    (id)          => api.post(`/dispatch/invoices/percent/${id}/open/`),
  amount:  (id)          => api.get(`/dispatch/invoices/percent/${id}/amount/`),
};

export const hourInvoicesService = {
  list:    (params)      => api.get('/dispatch/invoices/hour/', { params }),
  get:     (id)          => api.get(`/dispatch/invoices/hour/${id}/`),
  create:  (data)        => api.post('/dispatch/invoices/hour/', data),
  update:  (id, data)    => api.patch(`/dispatch/invoices/hour/${id}/`, data),
  close:   (id)          => api.post(`/dispatch/invoices/hour/${id}/close/`),
  open:    (id)          => api.post(`/dispatch/invoices/hour/${id}/open/`),
  amount:  (id)          => api.get(`/dispatch/invoices/hour/${id}/amount/`),
};

export const dispatchersService = {
  options: () => api.get('/dispatch/dispatchers/'),
};
