import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';

vi.mock('../../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

import { useAuth } from '../../contexts/useAuth';
import { useDashboard } from '../../hooks/useDashboard';

// ---- Helpers to build auth mock ----

function makeAuth(roles = []) {
  return {
    user: { full_name: 'Test User', username: 'testuser', roles },
    can: (p) => roles.includes('root') || roles.includes(p),
    haveAnyPermission: (ps) =>
      roles.includes('root') || ps.some((p) => roles.includes(p)),
  };
}

const ADMIN_AUTH = makeAuth(['admin']);
const DISPATCHER_AUTH = makeAuth(['dispatcher']);
const PLAIN_AUTH = makeAuth([]);

// ---- Mock data ----

// Maintenance mock uses DIFFERENT numbers from expiration alert trucks (101, 200)
// to avoid "Found multiple elements" ambiguity in tab-switching tests.
const MOCK_MAINTENANCE_TRUCKS = [
  {
    truck_id: 55,
    truck_number: '999',
    maintenance_id: 10,
    date: '2025-01-01',
    detail: 'Oil change',
    time_alert_triggered: true,
    alert_date: '2026-01-01',
    miles_alert_triggered: false,
    miles_traveled: null,
    miles_threshold: null,
  },
];

const MOCK_MAINTENANCE_TRAILERS = [
  {
    trailer_id: 88,
    trailer_number: '888',
    maintenance_id: 20,
    date: '2025-03-01',
    detail: 'Brake check',
    time_alert_triggered: true,
    alert_date: '2026-03-01',
    miles_alert_triggered: false,
    miles_traveled: null,
    miles_threshold: null,
  },
];

const MOCK_DATA = {
  stats: {
    loads_in_dispatch: 25,
    executed_loads: 63,
    invoiced: 53,
  },
  expiration_alerts: {
    drivers: [
      {
        id: 5,
        name: 'Runell Driver',
        alerts: [
          {
            type: 'license',
            label: 'License',
            expires_on: '2026-07-11',
            days_until: 15,
            expired: false,
          },
          {
            type: 'medical_card',
            label: 'Medical Card',
            expires_on: '2026-07-07',
            days_until: 11,
            expired: false,
          },
        ],
      },
      {
        id: 9,
        name: 'John Doe',
        alerts: [
          {
            type: 'license',
            label: 'License',
            expires_on: '2026-06-01',
            days_until: -25,
            expired: true,
          },
          {
            type: 'record',
            label: 'Record',
            expires_on: '2026-06-22',
            days_until: -4,
            expired: true,
          },
        ],
      },
    ],
    trucks: [
      {
        id: 3,
        name: 'Truck #101',
        alerts: [
          {
            type: 'avi',
            label: 'AVI',
            expires_on: '2026-07-01',
            days_until: 5,
            expired: false,
          },
        ],
      },
    ],
    trailers: [
      {
        id: 7,
        name: 'Trailer #200',
        alerts: [
          {
            type: 'annual_inspection',
            label: 'Annual Inspection',
            expires_on: '2026-07-10',
            days_until: 14,
            expired: false,
          },
        ],
      },
    ],
    categories: [
      {
        id: 42,
        name: 'OIL001 - Oil Change / Truck #101',
        category_code: 'OIL001',
        category_name: 'Oil Change',
        truck_number: '101',
        trailer_number: null,
        alerts: [
          {
            type: 'category',
            label: 'Category',
            expires_on: '2026-07-05',
            days_until: 9,
            expired: false,
          },
        ],
      },
    ],
  },
  maintenance_alerts: {
    trucks: MOCK_MAINTENANCE_TRUCKS,
    trailers: MOCK_MAINTENANCE_TRAILERS,
  },
  counts: {
    drivers_expiring: 2,
    trucks_expiring: 1,
    trucks_maintenance_alerts: 1,
    trailers_expiring: 1,
    trailers_maintenance_alerts: 1,
    categories_expiring: 1,
  },
};

function renderPage(auth = ADMIN_AUTH, data = MOCK_DATA) {
  useAuth.mockReturnValue(auth);
  useDashboard.mockReturnValue({ data, loading: false, error: null, reload: vi.fn() });
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Stat cards — role-based visibility
// ---------------------------------------------------------------------------

describe('HomePage — stat cards role visibility', () => {
  it('admin sees all three stat cards', () => {
    renderPage(ADMIN_AUTH);
    expect(screen.getByText('Loads in Dispatch')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Executed Loads')).toBeInTheDocument();
    expect(screen.getByText('63')).toBeInTheDocument();
    expect(screen.getByText('Invoiced')).toBeInTheDocument();
    expect(screen.getByText('53')).toBeInTheDocument();
  });

  it('dispatcher sees only Loads in Dispatch', () => {
    renderPage(DISPATCHER_AUTH);
    expect(screen.getByText('Loads in Dispatch')).toBeInTheDocument();
    expect(screen.queryByText('Executed Loads')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoiced')).not.toBeInTheDocument();
  });

  it('regular user sees no stat cards', () => {
    renderPage(PLAIN_AUTH);
    expect(screen.queryByText('Loads in Dispatch')).not.toBeInTheDocument();
    expect(screen.queryByText('Executed Loads')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoiced')).not.toBeInTheDocument();
  });

  it('stat cards column hidden entirely for regular user', () => {
    renderPage(PLAIN_AUTH);
    expect(document.querySelector('.col-lg-3')).not.toBeInTheDocument();
  });

  it('renders invoiced percentage of executed loads for admin', () => {
    renderPage(ADMIN_AUTH);
    // 53 / 63 ≈ 84%
    expect(screen.getByText('84% of executed Loads')).toBeInTheDocument();
  });

  it('omits percentage when executed_loads is 0', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      stats: { loads_in_dispatch: 0, executed_loads: 0, invoiced: 0 },
    });
    expect(screen.queryByText(/% of executed Loads/)).not.toBeInTheDocument();
  });

  it('stat card hidden when API returns null for loads_in_dispatch (plain user)', () => {
    renderPage(PLAIN_AUTH, {
      ...MOCK_DATA,
      stats: { loads_in_dispatch: null, executed_loads: null, invoiced: null },
    });
    expect(screen.queryByText('Loads in Dispatch')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Drivers tab (default)
// ---------------------------------------------------------------------------

describe('HomePage — driver tab (default)', () => {
  it('shows Drivers tab active by default', () => {
    renderPage();
    const driversBtn = screen.getByRole('button', { name: /Drivers/i });
    expect(driversBtn.className).toContain('active');
  });

  it('shows driver names in the alert list', () => {
    renderPage();
    expect(screen.getByText('Runell Driver')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows drivers badge count', () => {
    renderPage();
    const driversBtn = screen.getByRole('button', { name: /Drivers/i });
    expect(driversBtn.querySelector('.badge')).toHaveTextContent('2');
  });

  it('shows warning icon for upcoming expiration', () => {
    renderPage();
    const warnings = document.querySelectorAll(
      '.bi-exclamation-triangle-fill.text-warning'
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('shows danger icon for already expired alert', () => {
    renderPage();
    const dangers = document.querySelectorAll(
      '.bi-exclamation-circle-fill.text-danger'
    );
    expect(dangers.length).toBeGreaterThan(0);
  });

  it('shows text-danger on expired alert label', () => {
    renderPage();
    const expiredLabels = document.querySelectorAll('span.text-danger');
    const hasExpiredLicense = Array.from(expiredLabels).some(
      (el) => el.textContent === 'License'
    );
    expect(hasExpiredLicense).toBe(true);
  });

  it('renders "Record" label for MVR/AR/D&A document (legacy parity)', () => {
    renderPage();
    const expiredLabels = document.querySelectorAll('span.text-danger');
    const hasRecord = Array.from(expiredLabels).some(
      (el) => el.textContent === 'Record'
    );
    expect(hasRecord).toBe(true);
  });

  it('shows days-ago text for expired alerts', () => {
    renderPage();
    expect(screen.getByText(/expired 25d ago/)).toBeInTheDocument();
  });

  it('shows days-remaining text for upcoming alerts', () => {
    renderPage();
    expect(screen.getByText(/\(15d\)/)).toBeInTheDocument();
  });

  it('does not show Maintenance Alerts section in Drivers tab', () => {
    renderPage();
    expect(screen.queryByText('Maintenance Alerts')).not.toBeInTheDocument();
  });

  it('shows expires_on date for upcoming alert', () => {
    renderPage();
    // Runell Driver has license expires_on 2026-07-11
    expect(screen.getByText(/— 2026-07-11/)).toBeInTheDocument();
  });

  it('shows expires_on date for expired alert', () => {
    renderPage();
    // John Doe has license expires_on 2026-06-01
    expect(screen.getByText(/— 2026-06-01/)).toBeInTheDocument();
  });

  it('omits date span when expires_on is absent', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      expiration_alerts: {
        ...MOCK_DATA.expiration_alerts,
        drivers: [
          {
            id: 99,
            name: 'No-Date Driver',
            alerts: [
              { type: 'license', label: 'License', days_until: 10, expired: false },
            ],
          },
        ],
      },
    });
    // No "— " date separator in the DOM
    expect(screen.queryByText(/— \d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

describe('HomePage — tab switching', () => {
  it('switches to Trucks tab and shows truck alerts', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText('Truck #101')).toBeInTheDocument();
  });

  it('switches to Trailers tab and shows trailer alerts', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trailers/i }));
    expect(screen.getByText('Trailer #200')).toBeInTheDocument();
  });

  it('switches to Categories tab and shows category alerts', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    expect(screen.getByText('OIL001 - Oil Change / Truck #101')).toBeInTheDocument();
  });

  it('hides driver list when Trucks tab is active', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.queryByText('Runell Driver')).not.toBeInTheDocument();
  });

  it('hides driver list when Categories tab is active', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    expect(screen.queryByText('Runell Driver')).not.toBeInTheDocument();
  });

  it('shows expires_on date in Trucks tab alert', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    // Truck #101 has avi expires_on 2026-07-01
    expect(screen.getByText(/— 2026-07-01/)).toBeInTheDocument();
  });

  it('shows expires_on date in Trailers tab alert', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trailers/i }));
    // Trailer #200 has annual_inspection expires_on 2026-07-10
    expect(screen.getByText(/— 2026-07-10/)).toBeInTheDocument();
  });

  it('shows expires_on date in Categories tab alert', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    // Category expires_on 2026-07-05
    expect(screen.getByText(/— 2026-07-05/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Maintenance alert details — Trucks tab
// ---------------------------------------------------------------------------

describe('HomePage — maintenance alert details (Trucks tab)', () => {
  beforeEach(() => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
  });

  it('shows Maintenance Alerts section heading', () => {
    expect(screen.getByText('Maintenance Alerts')).toBeInTheDocument();
  });

  it('shows truck number in maintenance row', () => {
    expect(screen.getByText('Truck #999')).toBeInTheDocument();
  });

  it('shows last maintenance date', () => {
    expect(screen.getByText(/Last maintenance: 2025-01-01/)).toBeInTheDocument();
  });

  it('shows alert date with detail text', () => {
    expect(
      screen.getByText(/Alert for maintenance at 2026-01-01/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Oil change/)).toBeInTheDocument();
  });

  it('shows wrench icon in maintenance row', () => {
    const wrenchIcons = document.querySelectorAll('.bi-wrench-adjustable.text-danger');
    expect(wrenchIcons.length).toBeGreaterThan(0);
  });

});

describe('HomePage — maintenance alert details (Trucks tab) — empty state', () => {
  it('shows "No maintenance alerts." when trucks maintenance list is empty', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: { trucks: [], trailers: MOCK_MAINTENANCE_TRAILERS },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText('No maintenance alerts.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Maintenance alert details — Trailers tab
// ---------------------------------------------------------------------------

describe('HomePage — maintenance alert details (Trailers tab)', () => {
  beforeEach(() => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trailers/i }));
  });

  it('shows Maintenance Alerts section heading in Trailers tab', () => {
    expect(screen.getByText('Maintenance Alerts')).toBeInTheDocument();
  });

  it('shows trailer number in maintenance row', () => {
    expect(screen.getByText('Trailer #888')).toBeInTheDocument();
  });

  it('shows last maintenance date for trailer', () => {
    expect(screen.getByText(/Last maintenance: 2025-03-01/)).toBeInTheDocument();
  });

  it('shows alert date and detail for trailer', () => {
    expect(
      screen.getByText(/Alert for maintenance at 2026-03-01/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Brake check/)).toBeInTheDocument();
  });

});

describe('HomePage — maintenance alert details (Trailers tab) — empty state', () => {
  it('shows "No maintenance alerts." when trailers maintenance list is empty', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: { trucks: MOCK_MAINTENANCE_TRUCKS, trailers: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trailers/i }));
    expect(screen.getByText('No maintenance alerts.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Categories tab has NO maintenance section
// ---------------------------------------------------------------------------

describe('HomePage — categories tab has no maintenance section', () => {
  it('does not show Maintenance Alerts heading on Categories tab', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    expect(screen.queryByText('Maintenance Alerts')).not.toBeInTheDocument();
  });

  it('does not show a link button for categories (no detail page yet)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    const arrowLinks = document.querySelectorAll('a .bi-arrow-right-circle');
    expect(arrowLinks.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Maintenance badges
// ---------------------------------------------------------------------------

describe('HomePage — maintenance alert badges', () => {
  it('renders wrench badge on Trucks tab for maintenance alerts', () => {
    renderPage();
    const truckBtn = screen.getByRole('button', { name: /Trucks/i });
    const wrenchIcons = truckBtn.querySelectorAll('.bi-wrench-adjustable');
    expect(wrenchIcons.length).toBeGreaterThan(0);
  });

  it('renders wrench badge on Trailers tab for maintenance alerts', () => {
    renderPage();
    const trailerBtn = screen.getByRole('button', { name: /Trailers/i });
    const wrenchIcons = trailerBtn.querySelectorAll('.bi-wrench-adjustable');
    expect(wrenchIcons.length).toBeGreaterThan(0);
  });

  it('does not render wrench badge when maintenance count is 0', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      counts: {
        ...MOCK_DATA.counts,
        trucks_maintenance_alerts: 0,
        trailers_maintenance_alerts: 0,
      },
    });
    const wrenchIcons = document.querySelectorAll(
      '.nav-item .badge .bi-wrench-adjustable'
    );
    expect(wrenchIcons.length).toBe(0);
  });

  it('does not render Drivers or Categories wrench badge', () => {
    renderPage();
    const driversBtn = screen.getByRole('button', { name: /Drivers/i });
    expect(driversBtn.querySelectorAll('.bi-wrench-adjustable').length).toBe(0);
    const categoriesBtn = screen.getByRole('button', { name: /Categories/i });
    expect(categoriesBtn.querySelectorAll('.bi-wrench-adjustable').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// My work Calendar link
// ---------------------------------------------------------------------------

describe('HomePage — My work Calendar link', () => {
  it('renders a link to /dispatch/my-calendar', () => {
    renderPage();
    const link = screen.getByText(/My work Calendar/i).closest('a');
    expect(link).toHaveAttribute('href', '/dispatch/my-calendar');
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('HomePage — loading state', () => {
  it('shows spinner while loading', () => {
    useAuth.mockReturnValue(ADMIN_AUTH);
    useDashboard.mockReturnValue({ data: null, loading: true, error: null, reload: vi.fn() });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(document.querySelector('.spinner-border')).toBeInTheDocument();
  });

  it('does not show stat cards while loading', () => {
    useAuth.mockReturnValue(ADMIN_AUTH);
    useDashboard.mockReturnValue({ data: null, loading: true, error: null, reload: vi.fn() });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.queryByText('Loads in Dispatch')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

describe('HomePage — empty alert states', () => {
  it('shows "No expiration alerts." when drivers list is empty', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      expiration_alerts: { ...MOCK_DATA.expiration_alerts, drivers: [] },
    });
    expect(screen.getByText('No expiration alerts.')).toBeInTheDocument();
  });

  it('shows "No expiration alerts." on Trucks tab when empty', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      expiration_alerts: { ...MOCK_DATA.expiration_alerts, trucks: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText('No expiration alerts.')).toBeInTheDocument();
  });

  it('shows "No expiration alerts." on Categories tab when empty', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      expiration_alerts: { ...MOCK_DATA.expiration_alerts, categories: [] },
      counts: { ...MOCK_DATA.counts, categories_expiring: 0 },
    });
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    expect(screen.getByText('No expiration alerts.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Maintenance row without detail text
// ---------------------------------------------------------------------------

describe('HomePage — maintenance row without detail', () => {
  it('shows alert date text even when detail is empty', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [{ ...MOCK_MAINTENANCE_TRUCKS[0], detail: '' }],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(
      screen.getByText(/Alert for maintenance at 2026-01-01/)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Miles-based maintenance alert rendering
// ---------------------------------------------------------------------------

const MOCK_MILES_ONLY_TRUCK = {
  truck_id: 77,
  truck_number: '777',
  maintenance_id: 30,
  date: '2025-06-01',
  detail: 'Tire rotation',
  time_alert_triggered: false,
  alert_date: null,
  miles_alert_triggered: true,
  miles_traveled: 14500.0,
  miles_threshold: 13000.0,
};

const MOCK_BOTH_ALERTS_TRUCK = {
  truck_id: 78,
  truck_number: '778',
  maintenance_id: 31,
  date: '2025-05-01',
  detail: 'Full service',
  time_alert_triggered: true,
  alert_date: '2026-05-01',
  miles_alert_triggered: true,
  miles_traveled: 15000.0,
  miles_threshold: 13000.0,
};

describe('HomePage — miles-based maintenance alert rendering (Trucks tab)', () => {
  it('shows miles-traveled alert text for miles-only alert', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_MILES_ONLY_TRUCK],
        trailers: [],
      },
      counts: { ...MOCK_DATA.counts, trucks_maintenance_alerts: 1 },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(
      screen.getByText(/miles traveled 14500/)
    ).toBeInTheDocument();
  });

  it('shows miles threshold in miles alert text', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_MILES_ONLY_TRUCK],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText(/Alert at 13000/)).toBeInTheDocument();
  });

  it('shows detail text appended to miles alert', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_MILES_ONLY_TRUCK],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText(/Tire rotation/)).toBeInTheDocument();
  });

  it('does NOT show time-based text when only miles alert is triggered', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_MILES_ONLY_TRUCK],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.queryByText(/Alert for maintenance at/)).not.toBeInTheDocument();
  });

  it('shows BOTH time and miles alert lines when both are triggered', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_BOTH_ALERTS_TRUCK],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText(/Alert for maintenance at 2026-05-01/)).toBeInTheDocument();
    expect(screen.getByText(/miles traveled 15000/)).toBeInTheDocument();
  });

  it('shows truck number correctly for miles-only alert', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_MILES_ONLY_TRUCK],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText('Truck #777')).toBeInTheDocument();
  });

  it('shows last maintenance date for miles-only alert', () => {
    renderPage(ADMIN_AUTH, {
      ...MOCK_DATA,
      maintenance_alerts: {
        trucks: [MOCK_MILES_ONLY_TRUCK],
        trailers: [],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText(/Last maintenance: 2025-06-01/)).toBeInTheDocument();
  });
});
