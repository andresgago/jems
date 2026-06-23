import { describe, it, expect } from 'vitest'
import { utcIsoToEtDisplay } from '../dates'

describe('utcIsoToEtDisplay', () => {
  it('returns empty string for falsy input', () => {
    expect(utcIsoToEtDisplay('')).toBe('')
    expect(utcIsoToEtDisplay(null)).toBe('')
    expect(utcIsoToEtDisplay(undefined)).toBe('')
  })

  it('passes through already-local "YYYY-MM-DD HH:MM" strings unchanged', () => {
    expect(utcIsoToEtDisplay('2024-01-09 10:30')).toBe('2024-01-09 10:30')
  })

  it('returns empty string for an unparseable value', () => {
    expect(utcIsoToEtDisplay('not-a-date')).toBe('')
  })

  it('converts UTC ISO string to ET in winter (UTC-5)', () => {
    // 2024-01-09 15:00 UTC = 2024-01-09 10:00 ET (EST, UTC-5)
    expect(utcIsoToEtDisplay('2024-01-09T15:00:00Z')).toBe('2024-01-09 10:00')
  })

  it('converts UTC ISO string to ET in summer (UTC-4, DST)', () => {
    // 2024-07-15 14:00 UTC = 2024-07-15 10:00 ET (EDT, UTC-4)
    expect(utcIsoToEtDisplay('2024-07-15T14:00:00Z')).toBe('2024-07-15 10:00')
  })

  it('handles midnight UTC correctly without flipping the date', () => {
    // 2024-01-09 05:00 UTC = 2024-01-09 00:00 ET (UTC-5)
    expect(utcIsoToEtDisplay('2024-01-09T05:00:00Z')).toBe('2024-01-09 00:00')
  })

  it('handles late-night ET without advancing the date into next day', () => {
    // 2024-01-10 04:59 UTC = 2024-01-09 23:59 ET (UTC-5)
    expect(utcIsoToEtDisplay('2024-01-10T04:59:00Z')).toBe('2024-01-09 23:59')
  })

  it('handles ISO strings with milliseconds', () => {
    expect(utcIsoToEtDisplay('2024-01-09T15:30:00.000Z')).toBe('2024-01-09 10:30')
  })

  it('handles ISO strings with explicit UTC offset', () => {
    // 2024-01-09T10:00:00-05:00 is the same instant as 15:00Z → ET 10:00
    expect(utcIsoToEtDisplay('2024-01-09T10:00:00-05:00')).toBe('2024-01-09 10:00')
  })
})
