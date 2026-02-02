import { describe, it, expect } from 'vitest';
import { nullSafeString, nullSafeMatch } from '../string';

describe('nullSafeString', () => {
  it('returns empty string for null', () => {
    expect(nullSafeString(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(nullSafeString(undefined)).toBe('');
  });

  it('converts number to string', () => {
    expect(nullSafeString(42)).toBe('42');
  });

  it('returns string as-is', () => {
    expect(nullSafeString('hello')).toBe('hello');
  });

  it('converts boolean to string', () => {
    expect(nullSafeString(true)).toBe('true');
  });

  it('converts zero to string', () => {
    expect(nullSafeString(0)).toBe('0');
  });
});

describe('nullSafeMatch', () => {
  it('extracts regex group', () => {
    expect(nullSafeMatch('abc123def', /(\d+)/, 1)).toBe('123');
  });

  it('returns default group index 1', () => {
    expect(nullSafeMatch('order-456', /order-(\d+)/)).toBe('456');
  });

  it('returns empty string when no match', () => {
    expect(nullSafeMatch('hello', /(\d+)/)).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(nullSafeMatch(null, /(\d+)/)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(nullSafeMatch(undefined, /(\d+)/)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(nullSafeMatch('', /(\d+)/)).toBe('');
  });

  it('returns empty string when group index out of range', () => {
    expect(nullSafeMatch('abc', /(a)/, 5)).toBe('');
  });
});
