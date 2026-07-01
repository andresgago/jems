export const DEFAULT_TRUCK_REPORT_FIELDS = [
  'number',
  'VIN',
  'cabintype',
  'make',
  'year',
  'owner',
  'loss_payee_id',
  'odometer_start',
];

export const TRUCK_REPORT_FIELDS = [
  { key: 'number', label: 'Number' },
  { key: 'VIN', label: 'Vin number' },
  { key: 'mac', label: 'Mac' },
  { key: 'serial_num', label: 'Serial Number' },
  { key: 'plate', label: 'Plate' },
  { key: 'transponder', label: 'Transponder' },
  { key: 'avi', label: 'AVI' },
  { key: 'aviexpiration', label: 'AVI expiration date' },
  { key: 'registrationexpiration', label: 'Registration expiration date' },
  { key: 'purchasedate', label: 'Purchase date' },
  { key: 'purchasecost', label: 'Purchase cost ($)' },
  { key: 'enginetype', label: 'Engine' },
  { key: 'cabintype', label: 'Model' },
  { key: 'transmissiontype', label: 'Transmission' },
  { key: 'type', label: 'Type' },
  { key: 'tiressize', label: 'Tires size' },
  { key: 'make', label: 'Make' },
  { key: 'grossweight', label: 'Gross weight' },
  { key: 'leasedowner', label: 'Company owns' },
  { key: 'owner', label: 'Owner' },
  { key: 'year', label: 'Year' },
  { key: 'dispatcher', label: 'Dispatcher' },
  { key: 'loss_payee_id', label: 'Loss payee' },
  { key: 'status', label: 'Status' },
  { key: 'odometer_start', label: 'Odometer Start' },
  { key: 'odometer_current', label: 'Odometer Current' },
  { key: 'carrier_start_date', label: 'Carrier Start Date' },
  { key: 'carrier_end_date', label: 'Carrier End Date' },
  { key: 'carrier_end_reason', label: 'Carrier End Reason' },
  { key: 'eld_id', label: 'Eld Id' },
  { key: 'factoring_account_id', label: 'Factoring Account Id' },
  { key: 'photo', label: 'Picture' },
];

export function parseTruckReportFields(value) {
  const allowed = new Set(TRUCK_REPORT_FIELDS.map((field) => field.key));
  const parsed = String(value || '')
    .split(',')
    .map((field) => field.trim())
    .filter((field) => allowed.has(field));
  return parsed.length ? parsed : DEFAULT_TRUCK_REPORT_FIELDS;
}

export function serializeTruckReportFields(fields) {
  return fields.join(',');
}
