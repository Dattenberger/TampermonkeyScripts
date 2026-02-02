import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../filename';

describe('sanitizeFilename', () => {
  it('appends .csv to normal input', () => {
    expect(sanitizeFilename('orders')).toBe('orders.csv');
  });

  it('replaces special characters with underscore', () => {
    expect(sanitizeFilename('file:name*test')).toBe('file_name_test.csv');
  });

  it('replaces multiple special chars', () => {
    expect(sanitizeFilename('a\\b/c:d')).toBe('a_b_c_d.csv');
  });

  it('returns fallback name for null', () => {
    const result = sanitizeFilename(null);
    expect(result).toMatch(/^order-\d+\.csv$/);
  });

  it('returns fallback name for undefined', () => {
    const result = sanitizeFilename(undefined);
    expect(result).toMatch(/^order-\d+\.csv$/);
  });

  it('returns fallback name for empty string', () => {
    const result = sanitizeFilename('');
    expect(result).toMatch(/^order-\d+\.csv$/);
  });
});
