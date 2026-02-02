import { describe, it, expect } from 'vitest';
import { formatGermanDate, formatDateFromISO } from '../date';

describe('formatGermanDate', () => {
  it('returns empty string for null', () => {
    expect(formatGermanDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatGermanDate(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatGermanDate('')).toBe('');
  });

  it('pads numeric DD.MM.YYYY', () => {
    expect(formatGermanDate('5.3.2024')).toBe('05.03.2024');
  });

  it('keeps already-padded DD.MM.YYYY', () => {
    expect(formatGermanDate('15.12.2024')).toBe('15.12.2024');
  });

  it('parses German text month with dot (1. März 2024)', () => {
    expect(formatGermanDate('1. März 2024')).toBe('01.03.2024');
  });

  it('parses German text month without dot (12 Oktober 2023)', () => {
    expect(formatGermanDate('12 Oktober 2023')).toBe('12.10.2023');
  });

  it('parses abbreviated month (1. Dez. 2025)', () => {
    expect(formatGermanDate('1. Dez. 2025')).toBe('01.12.2025');
  });

  it('returns empty string for invalid input', () => {
    expect(formatGermanDate('not a date')).toBe('');
  });
});

describe('formatDateFromISO', () => {
  it('returns empty string for null', () => {
    expect(formatDateFromISO(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateFromISO(undefined)).toBe('');
  });

  it('formats ISO date string', () => {
    const result = formatDateFromISO('2024-03-15T10:00:00Z');
    // The exact day depends on timezone, but format should be DD.MM.YYYY
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('returns empty string for invalid ISO string', () => {
    expect(formatDateFromISO('not-a-date')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatDateFromISO('')).toBe('');
  });
});
