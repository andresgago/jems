import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TruckOwnersPage from '../TruckOwnersPage';

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../../services/api';

const owners = [
  { id: 1, full_name: 'Express Fleet LLC', first_name: 'Express', last_name: 'Fleet LLC', email: 'ops@example.com', phone: '555', status: 1, owner_type: 2, percent: 10, insurance: 0, truck_amount: 0, driver_amount: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: owners });
  api.post.mockResolvedValue({ data: { ...owners[0], id: 2, full_name: 'New Owner' } });
  api.delete.mockResolvedValue({ data: {} });
});

describe('TruckOwnersPage', () => {
  it('lists active truck owners for the truck owner catalog', async () => {
    render(<TruckOwnersPage />);
    expect(await screen.findByText('Express Fleet LLC')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Express Fleet LLC/ })).toHaveTextContent('Owner Operator');
  });

  it('creates a truck owner through the fleet owners endpoint', async () => {
    render(<TruckOwnersPage />);
    await screen.findByText('Express Fleet LLC');

    fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Best' } });
    fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Wheels' } });
    fireEvent.click(screen.getByRole('button', { name: /New Owner/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/fleet/owners/', expect.objectContaining({
      first_name: 'Best',
      last_name: 'Wheels',
      owner_type: 2,
      status: 1,
    })));
  });
});
