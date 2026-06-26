import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../layout/Navbar';

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { full_name: 'Test User', username: 'testuser' },
    logout: vi.fn(),
    can: () => true,
    haveAnyPermission: () => true,
  }),
}));

function renderNavbar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>
  );
}

describe('Navbar active state', () => {
  it('marks Loads dropdown toggle active on /loads', () => {
    const { container } = renderNavbar('/loads');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Loads');
  });

  it('marks Loads dropdown toggle active on a load detail page /loads/42', () => {
    const { container } = renderNavbar('/loads/42');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Loads');
  });

  it('marks Loads dropdown toggle active on /loads/history', () => {
    const { container } = renderNavbar('/loads/history');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Loads');
  });

  it('renders History as a dropdown item inside the Loads dropdown', () => {
    renderNavbar('/loads/history');
    const historyLink = screen.getByRole('link', { name: /^History$/i });
    expect(historyLink).toBeDefined();
    expect(historyLink.classList.contains('dropdown-item')).toBe(true);
  });

  it('renders Executed, Invoicing, Payments links inside Loads dropdown', () => {
    const { container } = renderNavbar('/loads');
    const dropdownLinks = container.querySelectorAll('.dropdown-menu .dropdown-item');
    const texts = Array.from(dropdownLinks).map((el) => el.textContent);
    expect(texts).toContain('Executed');
    expect(texts).toContain('Invoicing');
    expect(texts).toContain('Payments');
    expect(texts).toContain('History');
  });

  it('no dropdown toggle is active on the homepage', () => {
    const { container } = renderNavbar('/');
    const loadsToggle = Array.from(
      container.querySelectorAll('.nav-link.dropdown-toggle')
    ).find((el) => el.textContent.includes('Loads'));
    expect(loadsToggle?.classList.contains('active')).toBe(false);
  });

  it('marks Accounting dropdown toggle active on /accounting/records', () => {
    const { container } = renderNavbar('/accounting/records');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('Accounting');
  });

  it('marks RTL dropdown toggle active on /rtl', () => {
    const { container } = renderNavbar('/rtl');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('RTL');
  });

  it('marks System dropdown toggle active on /settings/carriers', () => {
    const { container } = renderNavbar('/settings/carriers');
    const active = container.querySelector('.nav-link.dropdown-toggle.active');
    expect(active).not.toBeNull();
    expect(active.textContent).toContain('System');
  });
});
