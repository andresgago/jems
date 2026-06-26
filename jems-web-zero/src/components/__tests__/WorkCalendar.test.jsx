import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoist mocks so their references are available inside vi.mock factories
const { mockCalendar, mockMove, mockNavigate } = vi.hoisted(() => ({
  mockCalendar: vi.fn(),
  mockMove: vi.fn(),
  mockNavigate: vi.fn(),
}));

// FullCalendar doesn't run in jsdom — mock the whole module.
// Capture the callbacks passed as props so we can exercise them.
let capturedProps = {};
vi.mock('@fullcalendar/react', () => ({
  default: (props) => {
    capturedProps = props;
    return (
      <div
        data-testid="fullcalendar"
        data-editable={props.editable ? 'true' : 'false'}
        data-view={props.headerToolbar?.right}
      />
    );
  },
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));
vi.mock('@fullcalendar/interaction', () => ({ default: {} }));

vi.mock('../../services/dispatch', () => ({
  dispatchWorkService: {
    calendar: mockCalendar,
    move: mockMove,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import WorkCalendar from '../WorkCalendar';

function renderCalendar(props = {}) {
  capturedProps = {};
  return render(
    <MemoryRouter>
      <WorkCalendar {...props} />
    </MemoryRouter>
  );
}

describe('WorkCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendar.mockResolvedValue({ data: [] });
    mockMove.mockResolvedValue({ data: {} });
  });

  it('renders a FullCalendar widget', () => {
    renderCalendar();
    expect(screen.getByTestId('fullcalendar')).toBeInTheDocument();
  });

  it('is editable (drag-and-drop enabled)', () => {
    renderCalendar();
    expect(screen.getByTestId('fullcalendar').dataset.editable).toBe('true');
  });

  it('exposes month/week/day view buttons (legacy parity)', () => {
    renderCalendar();
    expect(screen.getByTestId('fullcalendar').dataset.view).toBe(
      'dayGridMonth,timeGridWeek,timeGridDay'
    );
  });

  it('calls dispatchWorkService.calendar with self_only=true by default', async () => {
    renderCalendar();
    const fetchInfo = {
      startStr: '2024-01-01T00:00:00',
      endStr: '2024-02-01T00:00:00',
    };
    const successCb = vi.fn();
    const failureCb = vi.fn();
    await capturedProps.events(fetchInfo, successCb, failureCb);
    expect(mockCalendar).toHaveBeenCalledWith({
      start: fetchInfo.startStr,
      end: fetchInfo.endStr,
      self_only: true,
    });
    expect(successCb).toHaveBeenCalledWith([]);
  });

  it('passes self_only=false when prop is false', async () => {
    renderCalendar({ selfOnly: false });
    const fetchInfo = { startStr: '2024-01-01', endStr: '2024-02-01' };
    await capturedProps.events(fetchInfo, vi.fn(), vi.fn());
    expect(mockCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ self_only: false })
    );
  });

  it('calls failureCallback when calendar service throws', async () => {
    mockCalendar.mockRejectedValue(new Error('network'));
    renderCalendar();
    const failureCb = vi.fn();
    await capturedProps.events({ startStr: '', endStr: '' }, vi.fn(), failureCb);
    expect(failureCb).toHaveBeenCalledWith(expect.any(Error));
  });

  it('navigates to work detail on event click', () => {
    renderCalendar();
    const clickInfo = {
      jsEvent: { preventDefault: vi.fn() },
      event: { id: '42' },
    };
    capturedProps.eventClick(clickInfo);
    expect(clickInfo.jsEvent.preventDefault).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/dispatch/work/42');
  });

  it('calls move service on event drop', async () => {
    renderCalendar();
    const dropInfo = {
      event: { id: '7', startStr: '2024-01-16T09:00:00' },
      revert: vi.fn(),
    };
    await capturedProps.eventDrop(dropInfo);
    expect(mockMove).toHaveBeenCalledWith('7', '2024-01-16T09:00:00');
    expect(dropInfo.revert).not.toHaveBeenCalled();
  });

  it('reverts event drop when move service throws', async () => {
    mockMove.mockRejectedValue(new Error('server error'));
    renderCalendar();
    const dropInfo = {
      event: { id: '7', startStr: '2024-01-16T09:00:00' },
      revert: vi.fn(),
    };
    await capturedProps.eventDrop(dropInfo);
    expect(dropInfo.revert).toHaveBeenCalled();
  });
});
