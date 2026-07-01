import { useOptions } from '../../hooks/useOptions';
import { TRAILER_STATUS } from '../../services/trailers';

export const TRAILER_REPORT_WINDOW_FEATURES = 'toolbar=yes,scrollbars=yes,menubar=yes';

function blank(value = ' - ') {
  return value === null || value === undefined || value === '' ? ' - ' : value;
}

function dateOnly(value) {
  if (!value) return ' - ';
  return String(value).slice(0, 10);
}

function money(value) {
  if (value === null || value === undefined || value === '') return ' - ';
  return `$ ${Number(value).toFixed(2)}`;
}

function decimal(value) {
  if (value === null || value === undefined || value === '') return ' - ';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function nameById(list, id, key = 'name') {
  const match = list.find((item) => String(item.id) === String(id));
  return match ? match[key] : null;
}

export function trailerFieldValue(key, trailer, lookups) {
  const values = {
    number: trailer.number,
    year: trailer.year,
    width: decimal(trailer.width),
    height: decimal(trailer.height),
    type: trailer.trailer_type_name || nameById(lookups.trailerTypes, trailer.trailer_type),
    status: TRAILER_STATUS[trailer.status]?.label,
    VIN: trailer.vin,
    aiexpiration: dateOnly(trailer.annual_inspection_expiration),
    plate: trailer.plate_number,
    state: trailer.plate_state_name || nameById(lookups.states, trailer.plate_state),
    purchasedate: dateOnly(trailer.purchase_date),
    purchasecost: money(trailer.purchase_cost),
    rent: trailer.is_rented ? 'Yes' : 'No',
    losspayee: trailer.loss_payee,
    created_at: dateOnly(trailer.created_at),
    updated_at: dateOnly(trailer.updated_at),
    created_by: trailer.created_by_name,
    // JEMS' Trailer model has no `updated_by` field (only `created_by`) —
    // kept in the field list for legacy label parity, always blank here.
    updated_by: null,
    carrier_start_date: dateOnly(trailer.carrier_start_date),
    carrier_end_date: dateOnly(trailer.carrier_end_date),
    carrier_end_reason: trailer.carrier_end_reason,
    carrier: trailer.carrier_name || nameById(lookups.carriers, trailer.carrier),
    owner: trailer.owner_name || nameById(lookups.owners, trailer.owner, 'full_name'),
  };
  return blank(values[key]);
}

export function useTrailerReportLookups() {
  return {
    trailerTypes: useOptions('/fleet/trailer-types/'),
    states: useOptions('/locations/states/'),
    carriers: useOptions('/carriers/'),
    owners: useOptions('/fleet/owners/'),
  };
}
