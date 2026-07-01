import api from './api';

export const ACCIDENT_FILE_SLOTS = ['police_report', 'post_accident'];

export const accidentsService = {
  list:    (params) => api.get('/fleet/accidents/', { params }),
  get:     (id)     => api.get(`/fleet/accidents/${id}/`),
  create:  (data)   => api.post('/fleet/accidents/', data, { headers: { 'Content-Type': 'application/json' } }),
  update:  (id, data) => api.patch(`/fleet/accidents/${id}/`, data),
  destroy: (id)     => api.delete(`/fleet/accidents/${id}/`),
  bulkDelete: (ids) => api.post('/fleet/accidents/bulk-delete/', { ids }),

  uploadFile: (id, slot, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/fleet/accidents/${id}/files/${slot}/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  clearFile: (id, slot) => api.delete(`/fleet/accidents/${id}/files/${slot}/`),

  addPicture: (id, file, description = '') => {
    const fd = new FormData();
    fd.append('file', file);
    if (description) fd.append('description', description);
    return api.post(`/fleet/accidents/${id}/pictures/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  deletePicture: (id, pictureId) => api.delete(`/fleet/accidents/${id}/pictures/${pictureId}/`),
};
