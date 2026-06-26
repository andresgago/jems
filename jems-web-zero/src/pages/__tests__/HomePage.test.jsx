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
  },
  counts: {
    drivers_expiring: 2,
    trucks_expiring: 1,
    trucks_in_maintenance: 4,
    trailers_expiring: 1,
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

describe('HomePage — stat cards', () => {
  it('renders the In Dispatch stat', () => {
    renderPage();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('In Dispatch')).toBeInTheDocument();
  });

  it('renders the Executed stat', () => {
    renderPage();
    expect(screen.getByText('63')).toBeInTheDocument();
    expect(screen.getByText('Executed')).toBeInTheDocument();
  });

  it('renders the Invoiced stat', () => {
    renderPage();
    expect(screen.getByText('53')).toBeInTheDocument();
    expect(screen.getByText('Invoiced')).toBeInTheDocument();
  });

  it('renders the invoiced percentage of executed loads', () => {
    // 53 / 63 = 84%
    renderPage();
    expect(screen.getByText('84% of executed Loads')).toBeInTheDocument();
  });
});

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

  it('shows badge count on Drivers tab', () => {
    renderPage();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows warning icon for upcoming expiration (not expired)', () => {
    renderPage();
    // Runell Driver has expired=false alerts — warning triangle class
    const warnings = document.querySelectorAll('.bi-exclamation-triangle-fill.text-warning');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('shows danger icon for already expired alert', () => {
    renderPage();
    // John Doe has expired=true — danger circle class
    const dangers = document.querySelectorAll('.bi-exclamation-circle-fill.text-danger');
    expect(dangers.length).toBeGreaterThan(0);
  });

  it('shows text-danger class on expired alert label', () => {
    renderPage();
    // John Doe License — expired: true → label should have text-danger class
    const expiredLabels = document.querySelectorAll('span.text-danger');
    const hasExpiredLabel = Array.from(expiredLabels).some(
      (el) => el.textContent === 'License'
    );
    expect(hasExpiredLabel).toBe(true);
  });

  it('shows text-warning class on upcoming alert label', () => {
    renderPage();
    const warningLabels = document.querySelectorAll('span.text-warning');
    expect(warningLabels.length).toBeGreaterThan(0);
  });
});

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

  it('hides driver list when Trucks tab is active', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Trucks/i }));
    expect(screen.queryByText('Runell Driver')).not.toBeInTheDocument();
  });
});

describe('HomePage — My work Calendar link', () => {
  it('renders a link to /dispatch/my-calendar', () => {
    renderPage();
    const link = screen.getByText(/My work Calendar/i).closest('a');
    expect(link).toHaveAttribute('href', '/dispatch/my-calendar');
  });
});

describe('HomePage — loading state', () => {
  it('shows a spinner while loading', () => {
    useDashboard.mockReturnValue({ data: null, loading: true, error: null, reload: vi.fn() });
    renderPage();
    expect(document.querySelector('.spinner-border')).toBeInTheDocument();
  });

  it('does not show stat cards while loading', () => {
    useDashboard.mockReturnValue({ data: null, loading: true, error: null, reload: vi.fn() });
    renderPage();
    expect(screen.queryByText('In Dispatch')).not.toBeInTheDocument();
  });
});
