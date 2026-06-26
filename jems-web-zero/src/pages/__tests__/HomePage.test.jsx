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
  counts: {
    drivers_expiring: 2,
    trucks_expiring: 1,
    trucks_maintenance_alerts: 4,
    trailers_expiring: 1,
    trailers_maintenance_alerts: 2,
    categories_expiring: 1,
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { full_name: 'Admin User', username: 'admin' } });
  useDashboard.mockReturnValue({ data: MOCK_DATA, loading: false, error: null, reload: vi.fn() });
});

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

describe('HomePage — stat cards', () => {
  it('renders Loads in Dispatch label and value', () => {
    renderPage();
    expect(screen.getByText('Loads in Dispatch')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('renders Executed Loads label and value', () => {
    renderPage();
    expect(screen.getByText('Executed Loads')).toBeInTheDocument();
    expect(screen.getByText('63')).toBeInTheDocument();
  });

  it('renders Invoiced label and value', () => {
    renderPage();
    expect(screen.getByText('Invoiced')).toBeInTheDocument();
    expect(screen.getByText('53')).toBeInTheDocument();
  });

  it('renders invoiced percentage of executed loads', () => {
    // 53 / 63 ≈ 84%
    renderPage();
    expect(screen.getByText('84% of executed Loads')).toBeInTheDocument();
  });

  it('omits percentage when executed_loads is 0', () => {
    useDashboard.mockReturnValue({
      data: {
        ...MOCK_DATA,
        stats: { loads_in_dispatch: 0, executed_loads: 0, invoiced: 0 },
      },
      loading: false,
    });
    renderPage();
    expect(screen.queryByText(/% of executed Loads/)).not.toBeInTheDocument();
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
    useDashboard.mockReturnValue({
      data: {
        ...MOCK_DATA,
        counts: {
          ...MOCK_DATA.counts,
          trucks_maintenance_alerts: 0,
          trailers_maintenance_alerts: 0,
        },
      },
      loading: false,
    });
    renderPage();
    // Wrench icon badges should not appear when count is 0
    const wrenchIcons = document.querySelectorAll('.bi-wrench-adjustable');
    expect(wrenchIcons.length).toBe(0);
  });

  it('does not render Drivers or Categories wrench badge (no maintenance)', () => {
    renderPage();
    const driversBtn = screen.getByRole('button', { name: /Drivers/i });
    expect(driversBtn.querySelectorAll('.bi-wrench-adjustable').length).toBe(0);
    const categoriesBtn = screen.getByRole('button', { name: /Categories/i });
    expect(categoriesBtn.querySelectorAll('.bi-wrench-adjustable').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Categories tab
// ---------------------------------------------------------------------------

describe('HomePage — categories tab', () => {
  it('renders Categories tab with expiration badge', () => {
    renderPage();
    const categoriesBtn = screen.getByRole('button', { name: /Categories/i });
    expect(categoriesBtn.querySelector('.badge')).toBeInTheDocument();
  });

  it('shows "No expiration alerts" when categories list is empty', () => {
    useDashboard.mockReturnValue({
      data: {
        ...MOCK_DATA,
        expiration_alerts: {
          ...MOCK_DATA.expiration_alerts,
          categories: [],
        },
        counts: { ...MOCK_DATA.counts, categories_expiring: 0 },
      },
      loading: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    expect(screen.getByText('No expiration alerts.')).toBeInTheDocument();
  });

  it('does not show a link button for categories (no detail page yet)', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Categories/i }));
    // The category row should NOT have an arrow-right link button
    const arrowLinks = document.querySelectorAll('a .bi-arrow-right-circle');
    expect(arrowLinks.length).toBe(0);
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
    useDashboard.mockReturnValue({ data: null, loading: true, error: null, reload: vi.fn() });
    renderPage();
    expect(document.querySelector('.spinner-border')).toBeInTheDocument();
  });

  it('does not show stat cards while loading', () => {
    useDashboard.mockReturnValue({ data: null, loading: true, error: null, reload: vi.fn() });
    renderPage();
    expect(screen.queryByText('Loads in Dispatch')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

describe('HomePage — empty alert states', () => {
  it('shows "No expiration alerts." when drivers list is empty', () => {
    useDashboard.mockReturnValue({
      data: {
        ...MOCK_DATA,
        expiration_alerts: { ...MOCK_DATA.expiration_alerts, drivers: [] },
      },
      loading: false,
    });
    renderPage();
    expect(screen.getByText('No expiration alerts.')).toBeInTheDocument();
  });

  it('shows "No expiration alerts." on Trucks tab when empty', () => {
    useDashboard.mockReturnValue({
      data: {
        ...MOCK_DATA,
        expiration_alerts: { ...MOCK_DATA.expiration_alerts, trucks: [] },
      },
      loading: false,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.getByText('No expiration alerts.')).toBeInTheDocument();
  });
});
