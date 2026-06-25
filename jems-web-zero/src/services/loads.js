import api from './api';

export const LOAD_STATUS = {
  1: { label: 'Registered', cls: 'secondary' },
  2: { label: 'Started',    cls: 'primary'   },
  3: { label: 'Finished',   cls: 'success'   },
  4: { label: 'Detention',  cls: 'warning'   },
  5: { label: 'Cancelled',  cls: 'danger'    },
};

export const loadsService = {
  list:      (params) => api.get('/loads/', { params }),
  get:       (id)     => api.get(`/loads/${id}/`),
  create:    (data)   => api.post('/loads/', data),
  update:    (id, data) => api.patch(`/loads/${id}/`, data),
  destroy:   (id)     => api.delete(`/loads/${id}/`),
  setStatus: (id, status) => api.post(`/loads/${id}/set-status/`, { status }),
  toggleInvoiced:(id) => api.post(`/loads/${id}/set-invoiced/`),
  togglePaid:(id)     => api.post(`/loads/${id}/set-paid/`),
  setHistory:(id)     => api.post(`/loads/${id}/set-history/`),
  setExecuted:(id)    => api.post(`/loads/${id}/set-executed/`),
  assign:    (id, data) => api.post(`/loads/${id}/assign/`, data),
  setRating: (id, data) => api.post(`/loads/${id}/set-rating/`, data),
};
