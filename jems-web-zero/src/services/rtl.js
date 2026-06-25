import api from './api';

export const HOS_EVENT_CODES = {
  DS_D:      { label: 'Driving',       cls: 'success' },
  DS_ON:     { label: 'On Duty',       cls: 'success' },
  DS_SB:     { label: 'Sleeper',       cls: 'secondary' },
  DS_PC:     { label: 'PC',            cls: 'secondary' },
  DS_YM:     { label: 'YM',            cls: 'secondary' },
  DS_WT:     { label: 'WT',            cls: 'secondary' },
  DR_IND_PC: { label: 'Personal Use',  cls: 'secondary' },
};

export const DEFAULT_HOS = { label: 'Off Duty', cls: 'secondary' };

export function getHosStatus(code) {
  return HOS_EVENT_CODES[code] || DEFAULT_HOS;
}

export const rtlService = {
  // Drivers
  listDrivers:  (params) => api.get('/integrations/rtl/drivers/', { params }),
  getDriver:    (id)     => api.get(`/integrations/rtl/drivers/${id}/`),

  // Trucks
  listTrucks:   (params) => api.get('/integrations/rtl/trucks/', { params }),
  getTruck:     (id)     => api.get(`/integrations/rtl/trucks/${id}/`),

  // IFTA synced reports
  listIfta:     (params) => api.get('/integrations/rtl/ifta/', { params }),
  getIfta:      (id)     => api.get(`/integrations/rtl/ifta/${id}/`),

  // Local IFTA report jobs
  listReports:  ()       => api.get('/integrations/ifta-reports/'),
  createReport: (data)   => api.post('/integrations/ifta-reports/', data),
  deleteReport: (id)     => api.delete(`/integrations/ifta-reports/${id}/`),

  // Manual sync (passive data-push, used by Celery task)
  sync:         (data)   => api.post('/integrations/rtl/sync/', data),

  // Active fetch: pulls fresh data from the ApexHOS API for all carriers
  fetchAndSync: ()       => api.post('/integrations/rtl/fetch-and-sync/'),
};
