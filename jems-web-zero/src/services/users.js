import api from './api';

export const USER_STATUS = {
  10: { label: 'Active', cls: 'success' },
  0: { label: 'Inactive', cls: 'secondary' },
};

export const DISPATCHER_TYPES = {
  0: 'Main',
  1: 'Assistant',
};

export const USER_CONTRACTS = {
  0: 'By Percent',
  1: 'By Hour',
};

export const USER_FILE_SLOTS = ['photo'];

export const usersService = {
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  options: (params) => api.get('/users/options/', { params }),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.patch(`/users/${id}/`, data),
  destroy: (id) => api.delete(`/users/${id}/`),
  toggleStatus: (id) => api.post(`/users/${id}/toggle-status/`),
  uploadFile: (id, slot, file) => {
    if (slot !== 'photo') throw new Error('Unknown user file slot.');
    const formData = new FormData();
    formData.append('photo', file);
    return api.post(`/users/${id}/photo/`, formData, { headers: { 'Content-Type': undefined } });
  },
  deleteFile: (id, slot) => {
    if (slot !== 'photo') throw new Error('Unknown user file slot.');
    return api.delete(`/users/${id}/photo/`);
  },
  getConfig: () => api.get('/users/settings/config/'),
  updateConfig: (data) => api.patch('/users/settings/config/', data),
  getDisplayOptions: () => api.get('/users/settings/display-options/'),
  updateDisplayOptions: (data) => api.patch('/users/settings/display-options/', data),
};
