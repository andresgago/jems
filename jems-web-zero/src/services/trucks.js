import api from './api';

export const TRUCK_STATUS = {
  1: { label: 'Active', cls: 'success' },
  0: { label: 'Inactive', cls: 'secondary' },
};

export const trucksService = {
  list:         (params) => api.get('/fleet/trucks/', { params }),
  get:          (id)     => api.get(`/fleet/trucks/${id}/`),
  options:      ()       => api.get('/fleet/trucks/options/'),
  create:       (data)   => api.post('/fleet/trucks/', data),
  update:       (id, data) => api.patch(`/fleet/trucks/${id}/`, data),
  destroy:      (id)     => api.delete(`/fleet/trucks/${id}/`),
  toggleStatus: (id)     => api.post(`/fleet/trucks/${id}/toggle-status/`),

  uploadFile: (id, slot, file) => {
    const fd = new FormData();
    fd.append('file', file);
    // Content-Type undefined lets axios/browser set the multipart boundary.
    return api.post(`/fleet/trucks/${id}/files/${slot}/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  deleteFile: (id, slot) => api.delete(`/fleet/trucks/${id}/files/${slot}/`),
  storeFile: (id, slot) => api.post(`/fleet/trucks/${id}/files/${slot}/store/`),
  deleteStoredFile: (id, fileId) => api.delete(`/fleet/trucks/${id}/stored-files/${fileId}/`),
};

// Document slots (the photo is handled separately as an image).
export const TRUCK_FILE_SLOTS = [
  { slot: 'avi', label: 'AVI', field: 'avi_file' },
  { slot: 'registration', label: 'Registration', field: 'registration_file' },
  { slot: 'agreement', label: 'Contract / Agreement', field: 'agreement_file' },
  { slot: 'leased', label: 'Leased Agreement', field: 'leased_file' },
];
