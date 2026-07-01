import { useOptions } from '../../hooks/useOptions';
import { TRUCK_STATUS } from '../../services/trucks';
import { mediaUrl } from '../../utils/media';

export const TRUCK_REPORT_WINDOW_FEATURES = 'toolbar=yes,scrollbars=yes,menubar=yes';

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

function fileDate(file, date) {
  return file ? dateOnly(date) : '-';
}

export function truckFieldValue(key, truck, lookups, { exportMode = false } = {}) {
  const values = {
    number: truck.number,
    VIN: truck.vin,
    mac: truck.mac_address,
    serial_num: truck.serial_number,
    plate: truck.plate,
    transponder: truck.transponder,
    avi: truck.avi_file ? (exportMode ? 'AVI' : fileDate(truck.avi_file, truck.avi_expiration)) : '-',
    aviexpiration: fileDate(truck.avi_file, truck.avi_expiration),
    registrationexpiration: fileDate(truck.registration_file, truck.registration_expiration),
    purchasedate: dateOnly(truck.purchase_date),
    purchasecost: money(truck.purchase_cost),
    enginetype: nameById(lookups.engineTypes, truck.engine_type),
    cabintype: nameById(lookups.cabinTypes, truck.cabin_type),
    transmissiontype: nameById(lookups.transmissionTypes, truck.transmission_type),
    type: truck.truck_type_name || nameById(lookups.truckTypes, truck.truck_type),
    tiressize: nameById(lookups.tireSizes, truck.tire_size),
    make: nameById(lookups.makes, truck.make),
    grossweight: decimal(truck.gross_weight),
    leasedowner: truck.is_leased ? 'Leased' : 'Owner',
    owner: truck.is_leased ? nameById(lookups.owners, truck.owner, 'full_name') || 'Not Defined' : ' - ',
    year: truck.year,
    dispatcher: nameById(lookups.users, truck.dispatcher, 'full_name') || 'For All Dispatcher',
    loss_payee_id: nameById(lookups.lossPayees, truck.loss_payee),
    status: TRUCK_STATUS[truck.status]?.label,
    odometer_start: decimal(truck.odometer_start),
    odometer_current: decimal(truck.odometer_current),
    carrier_start_date: dateOnly(truck.carrier_start_date),
    carrier_end_date: dateOnly(truck.carrier_end_date),
    carrier_end_reason: truck.carrier_end_reason,
    eld_id: truck.eld_id,
    factoring_account_id: truck.factoring_account_id,
    photo: mediaUrl(truck.photo) && !exportMode
      ? <img src={mediaUrl(truck.photo)} alt="" className="driver-report-photo" />
      : (mediaUrl(truck.photo) ? 'Picture' : ' - '),
  };
  return blank(values[key]);
}

export function useTruckReportLookups() {
  return {
    truckTypes: useOptions('/fleet/truck-types/'),
    makes: useOptions('/fleet/makes/'),
    engineTypes: useOptions('/fleet/engine-types/'),
    cabinTypes: useOptions('/fleet/cabin-types/'),
    transmissionTypes: useOptions('/fleet/transmission-types/'),
    tireSizes: useOptions('/fleet/tire-sizes/'),
    owners: useOptions('/fleet/owners/'),
    users: useOptions('/users/'),
    lossPayees: useOptions('/fleet/loss-payees/'),
  };
}
