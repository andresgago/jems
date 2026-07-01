export const DEFAULT_TRAILER_REPORT_FIELDS = ['number', 'VIN', 'year', 'losspayee'];

// Order and label text mirror the legacy "Trailer Fields Check For Reports"
// modal exactly (screenshot-confirmed). Note: JEMS' Trailer model has no
// `updated_by` field (only `created_by`) — the label is kept for legacy
// parity but trailerFieldValue() resolves it to blank.
export const TRAILER_REPORT_FIELDS = [
  { key: 'number', label: 'Number' },
  { key: 'year', label: 'Year' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'VIN', label: 'Vin Number' },
  { key: 'aiexpiration', label: 'Annual inspection expiration date' },
  { key: 'plate', label: 'Plate' },
  { key: 'state', label: 'State' },
  { key: 'purchasedate', label: 'Purchase Date' },
  { key: 'purchasecost', label: 'Purchase Cost' },
  { key: 'rent', label: 'Rent' },
  { key: 'losspayee', label: 'Loss Payee' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
  { key: 'created_by', label: 'Created By' },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'carrier_start_date', label: 'Carrier Start Date' },
  { key: 'carrier_end_date', label: 'Carrier End Date' },
  { key: 'carrier_end_reason', label: 'Carrier End Reason' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'owner', label: 'Owner' },
];

export function parseTrailerReportFields(value) {
  const allowed = new Set(TRAILER_REPORT_FIELDS.map((field) => field.key));
  const parsed = String(value || '')
    .split(',')
    .map((field) => field.trim())
    .filter((field) => allowed.has(field));
  return parsed.length ? parsed : DEFAULT_TRAILER_REPORT_FIELDS;
}

export function serializeTrailerReportFields(fields) {
  return fields.join(',');
}
