import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOptions } from '../../hooks/useOptions';
import { driversService, DRIVER_CONTRACT, DRIVER_STATUS } from '../../services/drivers';
import { usersService } from '../../services/users';
import { mediaUrl } from '../../utils/media';
import {
  DEFAULT_DRIVER_REPORT_FIELDS,
  DRIVER_REPORT_FIELDS,
  parseDriverReportFields,
} from './driverReportFields';

function blank(value = '') {
  return value === null || value === undefined || value === '' ? '' : value;
}

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(value) {
  if (value === null || value === undefined || value === '') return '';
  return `$ ${Number(value).toFixed(2)}`;
}

function decimal(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toFixed(2);
}

function percent(value) {
  if (value === null || value === undefined || value === '') return '';
  return `${value} %`;
}

function formatState(driver, states) {
  const state = states.find((item) => String(item.id) === String(driver.license_state));
  if (!state) return 'Not assignment';
  const code = state.abbreviation || state.code;
  return code ? `${state.name} (${code})` : state.name;
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
    photo: mediaUrl(driver.photo) ? 'Picture' : '',
    cardfuel: driver.fuel_card_number || 'Not assignment',
    birth: dateOnly(driver.birth_date),
    hire: dateOnly(driver.hire_date),
    termination: dateOnly(driver.termination_date),
    address: driver.address,
    socialsecuritynumber: driver.social_security_number,
    factorfee: decimal(driver.factor_fee),
    teamdriver: driver.team_driver ? `Driver #${driver.team_driver}` : '',
    carrier: driver.carrier_name || 'Not assignment',
    created_at: dateOnly(driver.created_at),
    updated_at: dateOnly(driver.updated_at),
    created_by: driver.created_by,
    updated_by: driver.updated_by,
    carrier_start_date: dateOnly(driver.carrier_start_date),
    carrier_end_date: dateOnly(driver.carrier_end_date),
    carrier_end_reason: driver.carrier_end_reason,
    eld_id: driver.eld_id,
    factoring_account_id: driver.factoring_account_id,
  };
  return blank(values[key]);
}

function filterPlaceholder(field) {
  const placeholders = {
    name: 'Find by First Name',
    lastname: 'Find by Last Name',
    phone: 'Find by phone',
    birth: 'Find by Birth',
    licensenumber: 'Find by Licence',
    licensestate: 'Find by type',
  };
  return placeholders[field.key] || `Find by ${field.label}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function DriverExportPrintPage() {
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
        if (alive) setError('Error loading drivers export.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [ids]);

  const fields = DRIVER_REPORT_FIELDS.filter((field) => selectedFields.includes(field.key));

  const downloadCsv = () => {
    const rows = [
      ['#', ...fields.map((field) => field.label)],
      ...drivers.map((driver, index) => [
        index + 1,
        ...fields.map((field) => fieldValue(field.key, driver, states)),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drivers-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="driver-export-report-page">
      <div className="driver-list-report-date">Date: {today}</div>
      <h1>Driver List Report</h1>
      <hr />

      <div className="driver-export-panel">
        <div className="driver-export-panel-heading">
          <span />
          <strong>Showing {drivers.length ? 1 : 0}-{drivers.length} of {drivers.length} items.</strong>
        </div>
        <div className="driver-export-toolbar">
          <button className="btn btn-sm btn-light" type="button" title="All">
            <i className="bi bi-arrows-fullscreen me-1" />All
          </button>
          <button className="btn btn-sm btn-light" type="button" title="Export" onClick={downloadCsv} disabled={!drivers.length}>
            <i className="bi bi-file-earmark-spreadsheet-fill" />
            <i className="bi bi-caret-down-fill ms-1" />
          </button>
        </div>

        {loading && <div className="text-center text-muted py-3">Loading...</div>}
        {error && <div className="alert alert-danger m-2">{error}</div>}
        {!loading && !error && (
          <table className="driver-export-table">
            <thead>
              <tr>
                <th className="driver-export-number-col">#</th>
                {fields.map((field, index) => (
                  <th key={field.key}>
                    {field.label}
                    {index === 0 && <i className="bi bi-sort-down ms-1 text-primary" />}
                  </th>
                ))}
              </tr>
              <tr className="driver-export-filter-row">
                <th />
                {fields.map((field) => (
                  <th key={field.key}>
                    <input className="form-control form-control-sm" placeholder={filterPlaceholder(field)} readOnly />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver, index) => (
                <tr key={`${driver.id}-${index}`}>
                  <td>{index + 1}</td>
                  {fields.map((field) => (
                    <td key={field.key}>{fieldValue(field.key, driver, states)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="driver-export-report-footer">
        <div>Jobee Express LLC</div>
        <div>Copyright &copy; 2019 - {year}</div>
      </footer>
    </div>
  );
}
