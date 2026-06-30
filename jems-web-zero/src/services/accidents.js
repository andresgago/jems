import api from './api';

export const accidentsService = {
  list:    (params) => api.get('/fleet/accidents/', { params }),
  get:     (id)     => api.get(`/fleet/accidents/${id}/`),
  create:  (data)   => api.post('/fleet/accidents/', data),
  update:  (id, data) => api.patch(`/fleet/accidents/${id}/`, data),
  destroy: (id)     => api.delete(`/fleet/accidents/${id}/`),

  addPicture:    (id, file, description = '') => {
    const fd = new FormData();
    fd.append('file', file);
    if (description) fd.append('description', description);
    return api.post(`/fleet/accidents/${id}/pictures/`, fd, {
      headers: { 'Content-Type': undefined },
    });
  },
  deletePicture: (id, pictureId) => api.delete(`/fleet/accidents/${id}/pictures/${pictureId}/`),
};
