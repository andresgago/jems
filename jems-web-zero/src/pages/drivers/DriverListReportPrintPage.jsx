import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOptions } from '../../hooks/useOptions';
import { driversService, DRIVER_CONTRACT, DRIVER_STATUS } from '../../services/drivers';
import { usersService } from '../../services/users';
import { mediaUrl } from '../../utils/media';
import {
  DRIVER_REPORT_FIELDS,
  DEFAULT_DRIVER_REPORT_FIELDS,
  parseDriverReportFields,
} from './driverReportFields';

const WINDOW_FEATURES = 'toolbar=yes,scrollbars=yes,menubar=yes';

function blank(value = ' - ') {
  return value === null || value === undefined || value === '' ? ' - ' : value;
}

function dateOnly(value) {
  if (!value) return ' - ';
  return String(value).slice(0, 10);
}

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(value) {
  if (value === null || value === undefined || value === '') return ' - ';
  return `$ ${Number(value).toFixed(2)}`;
}

function decimal(value) {
  if (value === null || value === undefined || value === '') return ' - ';
  return Number(value).toFixed(2);
}

function percent(value) {
  if (value === null || value === undefined || value === '') return ' - ';
  return `${value} %`;
}

function formatState(driver, states) {
  const state = states.find((item) => String(item.id) === String(driver.license_state));
  if (!state) return 'Not assignment';
  const code = state.abbreviation || state.code;
  return code ? `${state.name} (${code})` : state.name;
}

function formatPhoto(driver) {
  const src = mediaUrl(driver.photo);
  if (!src) return ' - ';
  return <img src={src} alt="" className="driver-report-photo" />;
}

function fieldValue(key, driver, states) {
  const values = {
    name: driver.first_name,
    lastname: driver.last_name,
    type: driver.driver_type_name,
    email: driver.email,
    phone: driver.phone,
    licensenumber: driver.license_number,
    licensestate: formatState(driver, states),
    status: DRIVER_STATUS[driver.status]?.label,
    licenseexpiration: dateOnly(driver.license_expiration),
    factor: percent(driver.factor),
    medicalcardexpiration: dateOnly(driver.medical_card_expiration),
    contract: driver.contract_display || DRIVER_CONTRACT[driver.contract],
    milesempty: decimal(driver.miles_empty),
    milesfull: decimal(driver.miles_full),
    percent: percent(driver.percent),
    weekly_rate: money(driver.weekly_rate),
    insurance: money(driver.insurance),
    recordexpiration: dateOnly(driver.mvr_expiration),
    vacation: driver.pay_vacation_display,
    eld: money(driver.eld),
    workercomp: money(driver.worker_comp),
    photo: formatPhoto(driver),
    cardfuel: driver.fuel_card_number || 'Not assignment',
    birth: dateOnly(driver.birth_date),
    hire: dateOnly(driver.hire_date),
    termination: dateOnly(driver.termination_date),
    address: driver.address,
    socialsecuritynumber: driver.social_security_number,
    factorfee: decimal(driver.factor_fee),
    teamdriver: driver.team_driver ? `Driver #${driver.team_driver}` : ' - ',
    carrier: driver.carrier_name || 'Not assignment',
    created_at: dateOnly(driver.created_at),
    updated_at: dateOnly(driver.updated_at),
    created_by: driver.created_by || ' - ',
    updated_by: driver.updated_by || ' - ',
    carrier_start_date: dateOnly(driver.carrier_start_date),
    carrier_end_date: dateOnly(driver.carrier_end_date),
    carrier_end_reason: driver.carrier_end_reason,
    eld_id: driver.eld_id,
    factoring_account_id: driver.factoring_account_id,
  };
  return blank(values[key]);
}

export { WINDOW_FEATURES };

export default function DriverListReportPrintPage() {
  const [searchParams] = useSearchParams();
  const states = useOptions('/locations/states/');
  const [drivers, setDrivers] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_DRIVER_REPORT_FIELDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const idsKey = useMemo(() => {
    const raw = searchParams.get('ids') || searchParams.get('keylist') || '';
    return raw;
  }, [searchParams]);
  const ids = useMemo(() => idsKey.split(',').map((value) => value.trim()).filter(Boolean), [idsKey]);
  const today = localDate();
  const year = new Date().getFullYear();

  useEffect(() => {
    let alive = true;
    usersService.getDisplayOptions()
      .then((response) => {
        if (alive) setSelectedFields(parseDriverReportFields(response.data.driver));
      })
      .catch(() => {
        if (alive) setSelectedFields(DEFAULT_DRIVER_REPORT_FIELDS);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!ids.length) {
      setDrivers([]);
      return () => { alive = false; };
    }
    setLoading(true);
    setError('');
    Promise.all(ids.map((id) => driversService.get(id).then((response) => response.data)))
      .then((items) => {
        if (alive) setDrivers(items);
      })
      .catch(() => {
        if (alive) setError('Error loading drivers report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  const fields = DRIVER_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));

  return (
    <div className="driver-list-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Driver List Report</h1>

      {loading && <div className="text-center text-muted">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && ids.length === 0 && (
        <div className="text-center text-muted">No drivers selected.</div>
      )}

      {!loading && !error && drivers.map((driver, index) => (
        <section className="driver-report-section" key={`${driver.id}-${index}`}>
          <div className="driver-report-heading">
            <span># {index + 1}</span>
            <strong>{driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim()}</strong>
            <span />
          </div>

          <table className="driver-report-detail-table">
            <tbody>
              {fields.map((field) => (
                <tr key={field.key}>
                  <th>{field.label}</th>
                  <td>{fieldValue(field.key, driver, states)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="driver-list-report-footer">Copyright &copy; 2019 - {year}</footer>
    </div>
  );
}
