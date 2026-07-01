import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../layout/Navbar';

// Helper: render with a specific role profile
function makeAuth({ roles = [], fullName = 'Test User' } = {}) {
  return {
    user: { full_name: fullName, username: 'testuser' },
    logout: vi.fn(),
    can: (role) => roles.includes(role),
    haveAnyPermission: (list) => list.some((r) => roles.includes(r)),
  };
}

vi.mock('../../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/useAuth';

function renderNavbar(path = '/', roles = ['admin']) {
  useAuth.mockReturnValue(makeAuth({ roles }));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>
  );
}

describe('Navbar — Loads direct link', () => {
  it('renders Loads as a top-level nav-link (not a dropdown toggle)', () => {
    const { container } = renderNavbar('/loads');
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink).not.toBeNull();
    expect(loadsLink.classList.contains('dropdown-toggle')).toBe(false);
  });

  it('marks Loads nav-link active on /loads', () => {
    const { container } = renderNavbar('/loads');
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink?.classList.contains('active')).toBe(true);
  });

  it('marks Loads nav-link active on a load detail page /loads/42', () => {
    const { container } = renderNavbar('/loads/42');
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink?.classList.contains('active')).toBe(true);
  });

  it('Loads nav-link is NOT active on /loads/history', () => {
    const { container } = renderNavbar('/loads/history');
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink?.classList.contains('active')).toBe(false);
  });

  it('Loads nav-link is NOT active on /loads/executed (Payroll)', () => {
    const { container } = renderNavbar('/loads/executed');
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink?.classList.contains('active')).toBe(false);
  });

  it('no Loads nav-link is active on the homepage', () => {
    const { container } = renderNavbar('/');
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink?.classList.contains('active')).toBe(false);
  });

  it('dispatcher can see Loads link', () => {
    const { container } = renderNavbar('/loads', ['dispatcher']);
    const loadsLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Loads'
    );
    expect(loadsLink).not.toBeNull();
  });
});

describe('Navbar — Payroll direct link (= /loads/executed, admin only)', () => {
  it('renders Payroll as a top-level nav-link', () => {
    const { container } = renderNavbar('/loads/executed', ['admin']);
    const payrollLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Payroll'
    );
    expect(payrollLink).not.toBeNull();
    expect(payrollLink.classList.contains('dropdown-toggle')).toBe(false);
  });

  it('marks Payroll nav-link active on /loads/executed', () => {
    const { container } = renderNavbar('/loads/executed', ['admin']);
    const payrollLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Payroll'
    );
    expect(payrollLink?.classList.contains('active')).toBe(true);
  });

  it('dispatcher does NOT see Payroll link', () => {
    const { container } = renderNavbar('/loads/executed', ['dispatcher']);
    const payrollLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'Payroll'
    );
    expect(payrollLink).toBeUndefined();
  });
});

describe('Navbar — History direct link', () => {
  it('renders History as a top-level nav-link (not a dropdown item)', () => {
    const { container } = renderNavbar('/loads/history');
    const historyLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'History'
    );
    expect(historyLink).not.toBeNull();
    expect(historyLink.classList.contains('dropdown-item')).toBe(false);
  });

  it('marks History nav-link active on /loads/history', () => {
    const { container } = renderNavbar('/loads/history');
    const historyLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'History'
    );
    expect(historyLink?.classList.contains('active')).toBe(true);
  });

  it('History nav-link is NOT active on /loads', () => {
    const { container } = renderNavbar('/loads');
    const historyLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'History'
    );
    expect(historyLink?.classList.contains('active')).toBe(false);
  });

  it('dispatcher can see History link', () => {
    const { container } = renderNavbar('/loads/history', ['dispatcher']);
    const historyLink = Array.from(container.querySelectorAll('.nav-link')).find(
      (el) => el.textContent.trim() === 'History'
    );
    expect(historyLink).not.toBeNull();
  });
});

describe('Navbar — Accounting dropdown role guards', () => {
  it('admin sees full Accounting dropdown including Settings, Payments and Invoices sections', () => {
    const { container } = renderNavbar('/accounting/records', ['admin']);
    const items = Array.from(container.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).toContain('Accounting Records');
    expect(items).toContain('Add Record (Assistant)');
    expect(items).toContain('Categories');
    expect(items).toContain('Factor Percent List');
    expect(items).toContain('Vacations of Drivers');
    expect(items).toContain('Owner Operator');
    expect(items).toContain('Dispatchers by Percent Invoices');
    expect(items).toContain('Dispatchers by Hours Invoices');
    expect(items).toContain('Drivers Invoices');
    expect(items).toContain('Fix Invoices');
  });

  it('assistant sees Settings section but not the admin-only Accounting/Payments/Invoices', () => {
    const { container } = renderNavbar('/accounting/categories', ['assistant']);
    const items = Array.from(container.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).toContain('Categories');
    expect(items).not.toContain('Accounting Records');
    expect(items).not.toContain('Owner Operator');
    expect(items).not.toContain('Drivers Invoices');
  });

  it('assistant sees Settings section but NOT Payments or Invoices sections', () => {
    const { container } = renderNavbar('/accounting/categories', ['assistant']);
    const items = Array.from(container.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).toContain('Categories');
    expect(items).toContain('Types of Categories');
    expect(items).not.toContain('Owner Operator');
    expect(items).not.toContain('Drivers Invoices');
  });

  it('maintenance does NOT see Accounting dropdown', () => {
    const { container } = renderNavbar('/', ['maintenance']);
    const accountingToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.textContent.includes('Accounting'));
    expect(accountingToggle).toBeUndefined();
  });

  it('dispatcher does NOT see Accounting dropdown', () => {
    const { container } = renderNavbar('/', ['dispatcher']);
    const accountingToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.textContent.includes('Accounting'));
    expect(accountingToggle).toBeUndefined();
  });
});

describe('Navbar — gear dropdown legacy parity', () => {
  it('contains the same gear submenu items as legacy TMS', () => {
    const { container } = renderNavbar('/', ['admin']);
    const gearToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.querySelector('.bi-gear'));
    expect(gearToggle).not.toBeUndefined();

    const gearMenu = gearToggle.closest('.dropdown').querySelector('.dropdown-menu');
    const items = Array.from(gearMenu.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).toEqual([
      'Drivers',
      'Trucks',
      'Trailers',
      'Brokers',
      'Broker contacts',
      'Business',
      'Cities',
    ]);
  });

  it('admin does NOT see Users link in gear dropdown', () => {
    const { container } = renderNavbar('/', ['admin']);
    const usersLink = Array.from(container.querySelectorAll('.dropdown-item')).find(
      (el) => el.textContent.trim() === 'Users'
    );
    expect(usersLink).toBeUndefined();
  });
});

describe('Navbar — dispatcher My Records of Payments', () => {
  it('dispatcher sees My Records of Payments section in user dropdown', () => {
    const { container } = renderNavbar('/', ['dispatcher']);
    const items = Array.from(container.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).toContain('By Percent');
    expect(items).toContain('By Hour');
  });

  it('admin does NOT see My Records of Payments section', () => {
    const { container } = renderNavbar('/', ['admin']);
    const items = Array.from(container.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).not.toContain('By Percent');
    expect(items).not.toContain('By Hour');
  });
});

describe('Navbar — Tools dropdown', () => {
  it('admin sees Tools dropdown', () => {
    const { container } = renderNavbar('/', ['admin']);
    const toolsToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.textContent.includes('Tools'));
    expect(toolsToggle).not.toBeUndefined();
  });

  it('dispatcher sees Tools dropdown', () => {
    const { container } = renderNavbar('/', ['dispatcher']);
    const toolsToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.textContent.includes('Tools'));
    expect(toolsToggle).not.toBeUndefined();
  });

  it('maintenance does NOT see Tools dropdown', () => {
    const { container } = renderNavbar('/', ['maintenance']);
    const toolsToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.textContent.includes('Tools'));
    expect(toolsToggle).toBeUndefined();
  });

  it('Tools dropdown contains Drivers last loads, Send Packet, Brokers status', () => {
    const { container } = renderNavbar('/', ['admin']);
    const items = Array.from(container.querySelectorAll('.dropdown-item')).map(
      (el) => el.textContent.trim()
    );
    expect(items).toContain('Drivers last loads');
    expect(items).toContain('Send Packet');
    expect(items).toContain('Brokers status');
  });

  it('marks Tools dropdown active on /tools/drivers-last-loads', () => {
    const { container } = renderNavbar('/tools/drivers-last-loads', ['admin']);
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Tools');
  });
});

describe('Navbar — other dropdowns active state', () => {
  it('marks Accounting dropdown toggle active on /accounting/records', () => {
    const { container } = renderNavbar('/accounting/records');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Accounting');
  });

  it('marks ELD data dropdown toggle active on /rtl', () => {
    const { container } = renderNavbar('/rtl');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('ELD data');
  });

  it('marks Settings dropdown toggle active on /settings/carriers', () => {
    const { container } = renderNavbar('/settings/carriers');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Settings');
  });

  it('marks Maintenance dropdown toggle active on /fleet/truck-maintenance', () => {
    const { container } = renderNavbar('/fleet/truck-maintenance');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Maintenance');
  });
});
