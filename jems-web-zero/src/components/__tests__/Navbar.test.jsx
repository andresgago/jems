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
  it('marks Loads link active on /loads', () => {
    renderNavbar('/loads');
    expect(screen.getByRole('link', { name: /Loads/i })).toHaveClass('active');
  });

  it('marks Loads link active on a load detail page /loads/42', () => {
    renderNavbar('/loads/42');
    expect(screen.getByRole('link', { name: /Loads/i })).toHaveClass('active');
  });

  it('does not mark Loads active on /loads/history', () => {
    renderNavbar('/loads/history');
    expect(screen.getByRole('link', { name: /Loads/i })).not.toHaveClass('active');
  });

  it('marks History active on /loads/history', () => {
    renderNavbar('/loads/history');
    expect(screen.getByRole('link', { name: /History/i })).toHaveClass('active');
  });

  it('no link is active on the homepage', () => {
    renderNavbar('/');
    expect(screen.getByRole('link', { name: /Loads/i })).not.toHaveClass('active');
    expect(screen.getByRole('link', { name: /History/i })).not.toHaveClass('active');
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
