import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import RateLoadModal from '../RateLoadModal';

vi.mock('../../../services/loads', () => ({
  loadsService: {
    setRating: vi.fn(),
  },
}));

const LOAD = {
  id: 42,
  number: 'LD-00042',
  shipper_rating: 0,
  receiver_rating: 0,
  shipper_name: 'ACME Shipping',
  receiver_name: 'Bob Warehouse',
};

afterEach(() => {
  vi.clearAllMocks();
});

function renderModal(overrides = {}) {
  const props = {
    load: { ...LOAD, ...overrides.load },
    onClose: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  render(<RateLoadModal {...props} />);
  return props;
}

describe('RateLoadModal', () => {
  it('renders modal title with load number', () => {
    renderModal();
    expect(screen.getByText(/Rate Load: LD-00042/)).toBeInTheDocument();
  });

  it('renders shipper and receiver labels from load names', () => {
    renderModal();
    expect(screen.getByText(/ACME Shipping.*Shipper Rating/)).toBeInTheDocument();
    expect(screen.getByText(/Bob Warehouse.*Receiver Rating/)).toBeInTheDocument();
  });

  it('renders star buttons (10 per picker = 20 total)', () => {
    renderModal();
    const starBtns = screen.getAllByRole('button', { name: /Rate \d+/ });
    expect(starBtns).toHaveLength(20);
  });

  it('pre-populates existing ratings as filled stars', () => {
    renderModal({ load: { ...LOAD, shipper_rating: 7, receiver_rating: 3 } });
    // filled star icons: 7 + 3 = 10
    const filled = document.querySelectorAll('.bi-star-fill');
    expect(filled.length).toBe(10);
  });

  it('close button calls onClose', async () => {
    const { onClose } = renderModal();
    const closeBtns = screen.getAllByRole('button', { name: /^close$/i });
    await userEvent.click(closeBtns[closeBtns.length - 1]); // footer Close
    expect(onClose).toHaveBeenCalled();
  });

  it('submit calls setRating with correct payload', async () => {
    const { loadsService } = await import('../../../services/loads');
    loadsService.setRating.mockResolvedValue({ data: { ...LOAD, shipper_rating: 0, receiver_rating: 0 } });

    const { onSaved } = renderModal();

    // Click the "Rate 5" star in the first (shipper) picker — picks star index 5
    const allStars = screen.getAllByRole('button', { name: /Rate \d+/ });
    await userEvent.click(allStars[4]); // Rate 5 (0-indexed 4) for shipper

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(loadsService.setRating).toHaveBeenCalledWith(42, {
        shipper_rating: 5,
        receiver_rating: 0,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows error message on API failure', async () => {
    const { loadsService } = await import('../../../services/loads');
    loadsService.setRating.mockRejectedValue({
      response: { data: { error: 'Rating out of range.' } },
    });

    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('Rating out of range.')).toBeInTheDocument();
    });
  });

  it('clicking same star twice clears it back to 0', async () => {
    const { loadsService } = await import('../../../services/loads');
    loadsService.setRating.mockResolvedValue({ data: LOAD });

    renderModal();
    const allStars = screen.getAllByRole('button', { name: /Rate \d+/ });
    await userEvent.click(allStars[4]); // set shipper to 5
    await userEvent.click(allStars[4]); // toggle back to 0

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(loadsService.setRating).toHaveBeenCalledWith(42, {
        shipper_rating: 0,
        receiver_rating: 0,
      });
    });
  });
});
