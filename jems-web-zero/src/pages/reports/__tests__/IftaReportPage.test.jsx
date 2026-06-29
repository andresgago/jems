import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IftaReportPage from '../IftaReportPage';

vi.mock('flatpickr', () => ({ default: () => ({ destroy: vi.fn(), setDate: vi.fn() }) }));

const openSpy = vi.fn();
Object.defineProperty(window, 'open', { value: openSpy, writable: true });

function renderPage() {
  return render(
    <MemoryRouter>
      <IftaReportPage />
    </MemoryRouter>,
  );
}

describe('IftaReportPage', () => {
  beforeEach(() => { openSpy.mockReset(); });

  it('renders IFTA title and Show Report button', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /IFTA/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /show report/i })).toBeDefined();
  });

  it('renders Filter by Dates label', () => {
    renderPage();
    expect(screen.getByText('Filter by Dates')).toBeDefined();
  });

  it('opens print page in new window on Show Report click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    expect(openSpy).toHaveBeenCalledOnce();
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toMatch(/^\/print\/ifta\?/);
    expect(url).toContain('date_begin=');
    expect(url).toContain('date_end=');
    expect(target).toBe('_blank');
  });

  it('default date range is last 7 days', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /show report/i }));
    const [url] = openSpy.mock.calls[0];
    const params = new URLSearchParams(url.split('?')[1]);
    const begin = new Date(params.get('date_begin'));
    const end = new Date(params.get('date_end'));
    const diffDays = Math.round((end - begin) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it('does not render inline result table', () => {
    renderPage();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
