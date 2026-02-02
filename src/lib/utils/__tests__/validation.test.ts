import { describe, it, expect } from 'vitest';
import { validateOrderNumber, parseOrderNumbers } from '../validation';

describe('validateOrderNumber', () => {
  it('accepts 6+ digit numbers', () => {
    expect(validateOrderNumber('123456')).toBe(true);
    expect(validateOrderNumber('1234567890')).toBe(true);
  });

  it('rejects short numbers', () => {
    expect(validateOrderNumber('12345')).toBe(false);
    expect(validateOrderNumber('1')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(validateOrderNumber('abcdef')).toBe(false);
    expect(validateOrderNumber('123abc')).toBe(false);
  });

  it('rejects null', () => {
    expect(validateOrderNumber(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateOrderNumber(undefined)).toBe(false);
  });

  it('accepts numeric type', () => {
    expect(validateOrderNumber(123456)).toBe(true);
  });
});

describe('parseOrderNumbers', () => {
  it('parses comma-separated numbers', () => {
    const result = parseOrderNumbers('123456,789012');
    expect(result.valid).toEqual(['123456', '789012']);
    expect(result.invalid).toEqual([]);
  });

  it('parses space-separated numbers', () => {
    const result = parseOrderNumbers('123456 789012');
    expect(result.valid).toEqual(['123456', '789012']);
  });

  it('parses semicolon-separated numbers', () => {
    const result = parseOrderNumbers('123456;789012');
    expect(result.valid).toEqual(['123456', '789012']);
  });

  it('separates valid and invalid', () => {
    const result = parseOrderNumbers('123456,abc,789012,12');
    expect(result.valid).toEqual(['123456', '789012']);
    expect(result.invalid).toEqual(['abc', '12']);
  });

  it('returns empty arrays for null', () => {
    const result = parseOrderNumbers(null);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it('returns empty arrays for empty string', () => {
    const result = parseOrderNumbers('');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it('handles mixed separators', () => {
    const result = parseOrderNumbers('123456, 789012; 345678');
    expect(result.valid).toEqual(['123456', '789012', '345678']);
  });
});
