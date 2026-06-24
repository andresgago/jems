import api from './api';

export const CITY_STATUS = {
  true:  { label: 'Active',   cls: 'success' },
  false: { label: 'Inactive', cls: 'secondary' },
};

export const citiesService = {
  list:         (params) => api.get('/locations/cities/', { params }),
  get:          (id)     => api.get(`/locations/cities/${id}/`),
  states:       ()       => api.get('/locations/states/'),
  create:       (data)   => api.post('/locations/cities/', data),
  update:       (id, data) => api.patch(`/locations/cities/${id}/`, data),
  toggleStatus: (id)     => api.post(`/locations/cities/${id}/toggle-status/`),
};
