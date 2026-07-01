export const DEFAULT_DRIVER_REPORT_FIELDS = [
  'name',
  'lastname',
  'phone',
  'licensenumber',
  'licensestate',
  'birth',
];

export const DRIVER_REPORT_FIELDS = [
  { key: 'name', label: 'First Name' },
  { key: 'lastname', label: 'Last Name' },
  { key: 'type', label: 'Type' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'licensenumber', label: 'License number' },
  { key: 'licensestate', label: 'License state' },
  { key: 'status', label: 'Status' },
  { key: 'licenseexpiration', label: 'License Exp.Date' },
  { key: 'factor', label: '% Factor dispatch' },
  { key: 'medicalcardexpiration', label: 'Medical Card Exp.Date' },
  { key: 'contract', label: 'Work contract' },
  { key: 'milesempty', label: 'Empty miles' },
  { key: 'milesfull', label: 'Full miles' },
  { key: 'percent', label: 'By Percent' },
  { key: 'weekly_rate', label: 'Weekly Rate' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'recordexpiration', label: 'AR/MVR/D&A Exp.Date' },
  { key: 'vacation', label: 'Pay vacation' },
  { key: 'eld', label: 'ELD' },
  { key: 'workercomp', label: 'Worker comp' },
  { key: 'photo', label: 'Picture' },
  { key: 'cardfuel', label: 'Card fuel' },
  { key: 'birth', label: 'Date of birth' },
  { key: 'hire', label: 'Hire date' },
  { key: 'termination', label: 'Termination date' },
  { key: 'address', label: 'Address' },
  { key: 'socialsecuritynumber', label: 'Social security number' },
  { key: 'factorfee', label: 'Factor fee' },
  { key: 'teamdriver', label: 'Team driver' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
  { key: 'created_by', label: 'Created By' },
  { key: 'updated_by', label: 'Updated By' },
  { key: 'carrier_start_date', label: 'Carrier Start Date' },
  { key: 'carrier_end_date', label: 'Carrier End Date' },
  { key: 'carrier_end_reason', label: 'Carrier End Reason' },
  { key: 'eld_id', label: 'Eld Id' },
  { key: 'factoring_account_id', label: 'Factoring Account Id' },
];

export function parseDriverReportFields(value) {
  const allowed = new Set(DRIVER_REPORT_FIELDS.map((field) => field.key));
  const parsed = String(value || '')
    .split(',')
    .map((field) => field.trim())
    .filter((field) => allowed.has(field));
  return parsed.length ? parsed : DEFAULT_DRIVER_REPORT_FIELDS;
}

export function serializeDriverReportFields(fields) {
  return fields.join(',');
}
