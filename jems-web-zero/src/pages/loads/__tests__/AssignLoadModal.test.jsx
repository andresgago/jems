import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AssignLoadModal from '../AssignLoadModal';

vi.mock('../../../services/loads', () => ({
  loadsService: {
    assign: vi.fn(),
  },
}));

vi.mock('../../../services/drivers', () => ({
  driversService: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 1, full_name: 'John Driver', first_name: 'John', last_name: 'Driver' },
        { id: 2, full_name: 'Jane Driver', first_name: 'Jane', last_name: 'Driver' },
      ],
    }),
  },
}));

vi.mock('../../../services/trucks', () => ({
  trucksService: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 10, number: '855', vin: '4V4N99EH2GN937724', truck_type_name: 'Volvo 670' },
      ],
    }),
  },
}));

vi.mock('../../../services/trailers', () => ({
  trailersService: {
    options: vi.fn().mockResolvedValue({
      data: [
        { id: 20, number: '12279', vin: '1JJV532D4ML240740', trailer_type_name: 'Van' },
      ],
    }),
  },
}));

const LOAD = {
  id: 1,
  number: 'ABC123',
  driver: null,
  truck: null,
  trailer: null,
  is_drop: false,
  drop_place: null,
  drop_trailer: 0,
  days_in_drop: 0,
};

describe('AssignLoadModal', () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders modal title with load number', async () => {
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    expect(screen.getByText('Update Load: ABC123')).toBeInTheDocument();
  });

  test('renders driver, truck, trailer selects and populates options', async () => {
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    // There are 4 selects: Driver, Truck, Trailer, Is Drop Trailer
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(4);
    await waitFor(() => {
      expect(screen.getByText('John Driver')).toBeInTheDocument();
      expect(screen.getByText('855 - 4V4N99EH2GN937724 - Volvo 670')).toBeInTheDocument();
    });
  });

  test('drop section is hidden when is_drop=0', async () => {
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    expect(screen.queryByText('Drop Trailer ($)')).not.toBeInTheDocument();
  });

  test('drop section shows when is_drop switched to YES', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    const isDropSelect = screen.getByDisplayValue('NOT');
    await user.selectOptions(isDropSelect, '1');
    expect(screen.getByText('Drop Trailer ($)')).toBeInTheDocument();
    expect(screen.getByText('Days in Drop')).toBeInTheDocument();
  });

  test('drop section is hidden again when switched back to NOT', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    const isDropSelect = screen.getByDisplayValue('NOT');
    await user.selectOptions(isDropSelect, '1');
    await user.selectOptions(isDropSelect, '0');
    expect(screen.queryByText('Drop Trailer ($)')).not.toBeInTheDocument();
  });

  test('footer Close button calls onClose', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    // The footer has a "Close" button (the X header button also matches /close/, pick footer button)
    const closeButtons = screen.getAllByRole('button', { name: /^close$/i });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  test('submit calls loadsService.assign with correct payload', async () => {
    const { loadsService } = await import('../../../services/loads');
    loadsService.assign.mockResolvedValueOnce({ data: { id: 1, number: 'ABC123' } });

    const user = userEvent.setup();
    await act(async () => {
      render(
        <AssignLoadModal
          load={{ ...LOAD, driver: 1, truck: 10, trailer: 20 }}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    });
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(loadsService.assign).toHaveBeenCalledWith(1, expect.objectContaining({
        driver: 1,
        truck: 10,
        trailer: 20,
        is_drop: 0,
        drop_place: null,
      }));
    });
    expect(onSaved).toHaveBeenCalled();
  });

  test('submit sends null for empty driver/truck/trailer', async () => {
    const { loadsService } = await import('../../../services/loads');
    loadsService.assign.mockResolvedValueOnce({ data: { id: 1, number: 'ABC123' } });

    const user = userEvent.setup();
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(loadsService.assign).toHaveBeenCalledWith(1, expect.objectContaining({
        driver: null,
        truck: null,
        trailer: null,
      }));
    });
  });

  test('shows error message when assign fails', async () => {
    const { loadsService } = await import('../../../services/loads');
    loadsService.assign.mockRejectedValueOnce({
      response: { data: { error: 'Assignment failed' } },
    });

    const user = userEvent.setup();
    await act(async () => {
      render(<AssignLoadModal load={LOAD} onClose={onClose} onSaved={onSaved} />);
    });
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText('Assignment failed')).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('pre-populates form with current load values', async () => {
    await act(async () => {
      render(
        <AssignLoadModal
          load={{ ...LOAD, is_drop: true, days_in_drop: 3 }}
          onClose={onClose}
          onSaved={onSaved}
        />
      );
    });
    expect(screen.getByDisplayValue('YES')).toBeInTheDocument();
  });
});
