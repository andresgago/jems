import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAnyPermission } from '../App';

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/useAuth';

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/loads']}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route
          path="/loads"
          element={(
            <RequireAnyPermission permissions={['admin', 'dispatcher']}>
              <div>Loads Allowed</div>
            </RequireAnyPermission>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAnyPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when the user has one of the required permissions', () => {
    useAuth.mockReturnValue({ haveAnyPermission: vi.fn(() => true) });

    renderGuard();

    expect(screen.getByText('Loads Allowed')).toBeInTheDocument();
  });

  it('redirects home when the user lacks the required permissions', () => {
    useAuth.mockReturnValue({ haveAnyPermission: vi.fn(() => false) });

    renderGuard();

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Loads Allowed')).not.toBeInTheDocument();
  });
});
