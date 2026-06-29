import api from './api';

export const reportsService = {
  financial: (params) => api.get('/reports/financial/', { params }),
  invoice: (params) => api.get('/reports/invoice/', { params }),
  balanceSheet: (params) => api.get('/reports/balance-sheet/', { params }),
  ifta: (params) => api.get('/reports/ifta/', { params }),
  tax: (params) => api.get('/reports/tax/', { params }),
  categoryTracking: (params) => api.get('/reports/category-tracking/', { params }),
  brokerSummary: (params) => api.get('/reports/broker-summary/', { params }),
  shipperReceiver: (params) => api.get('/reports/shipper-receiver/', { params }),
};
