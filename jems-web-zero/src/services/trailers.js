import api from './api';

export const TRAILER_STATUS = {
  1: { label: 'Active', cls: 'success' },
  0: { label: 'Inactive', cls: 'secondary' },
};

export const trailersService = {
  list:         (params) => api.get('/fleet/trailers/', { params }),
  get:          (id)     => api.get(`/fleet/trailers/${id}/`),
  options:      ()       => api.get('/fleet/trailers/options/'),
  create:       (data)   => api.post('/fleet/trailers/', data),
  update:       (id, data) => api.patch(`/fleet/trailers/${id}/`, data),
  destroy:      (id)     => api.delete(`/fleet/trailers/${id}/`),
  toggleStatus: (id)     => api.post(`/fleet/trailers/${id}/toggle-status/`),

  uploadFile: (id, slot, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/fleet/trailers/${id}/files/${slot}/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  deleteFile: (id, slot) => api.delete(`/fleet/trailers/${id}/files/${slot}/`),
  storeFile: (id, slot) => api.post(`/fleet/trailers/${id}/files/${slot}/store/`),
  deleteStoredFile: (id, fileId) => api.delete(`/fleet/trailers/${id}/stored-files/${fileId}/`),
  getDropStatuses: () => api.get('/fleet/trailers/in-drop/'),
  // JWT auth is header-based (see services/api.js), so the PDF can't be
  // opened as a plain URL — fetch it as a blob and let the caller open/save it.
  getAviPdf: (id) => api.get(`/fleet/trailers/${id}/avi-pdf/`, { responseType: 'blob' }),
};

// Slots that support archiving to history (only annual_inspection has an
// expiration date to archive, matching legacy's Store button availability).
export const TRAILER_STORABLE_FILE_SLOTS = ['annual_inspection'];

// The 3 file slots for trailers (no photo, no leased — unlike trucks).
export const TRAILER_FILE_SLOTS = [
  { slot: 'annual_inspection', label: 'Annual Inspection', field: 'annual_inspection_file' },
  { slot: 'registration',      label: 'Registration',      field: 'registration_file' },
  { slot: 'agreement',         label: 'Agreement',         field: 'agreement_file' },
];
