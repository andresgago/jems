import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BalanceSheetReportPage from '../BalanceSheetReportPage';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

import api from '../../../services/api';

const CARRIER_OPTIONS = [
  { id: 2, label: 'BEST WHEELS TRANSPORT LLC (MC-1447438)' },
];

async function renderPageSettled() {
  const result = render(
    <MemoryRouter>
      <BalanceSheetReportPage />
    </MemoryRouter>,
  );
  await act(async () => {});
  return result;
}

describe('BalanceSheetReportPage', () => {
  let mockOpen;

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
    mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
  });

  it('renders the title and Show Report button', async () => {
    await renderPageSettled();
    expect(screen.getByText('Balance Sheet')).toBeDefined();
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
  });

  it('fetches carrier options on mount', async () => {
    await renderPageSettled();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/carriers/options/');
    });
  });

  it('renders carrier names instead of raw carrier fields', async () => {
    api.get.mockResolvedValue({ data: CARRIER_OPTIONS });
    await renderPageSettled();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'BEST WHEELS TRANSPORT LLC (MC-1447438)' })).toBeDefined();
    });
  });

  it('opens the balance sheet print page with selected carrier and period', async () => {
    api.get.mockResolvedValue({ data: CARRIER_OPTIONS });
    await renderPageSettled();
    await waitFor(() => screen.getByRole('option', { name: 'BEST WHEELS TRANSPORT LLC (MC-1447438)' }));

    fireEvent.change(screen.getByLabelText('Carrier'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));

    expect(mockOpen).toHaveBeenCalledOnce();
    const [url, target] = mockOpen.mock.calls[0];
    expect(target).toBe('_blank');
    expect(url).toContain('/print/balance-sheet?');
    expect(url).toContain('carrier=2');
    expect(url).toContain('period=1');
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
  });
});
