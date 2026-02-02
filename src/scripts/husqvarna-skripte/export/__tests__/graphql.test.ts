import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldRetryError, handleExportError, fetchOrderViaGraphQL } from '../graphql';
import { State } from '@scripts/husqvarna-skripte/state';

vi.mock('@lib/fetch', () => ({ gmFetch: vi.fn() }));
import { gmFetch } from '@lib/fetch';
const mockGmFetch = vi.mocked(gmFetch);

beforeEach(() => {
  State.orderCache.clear();
  State.activeDownloads.clear();
  State.downloadQueue.length = 0;
  State.retryCounters.clear();
  State.downloadStatusItems.clear();
  vi.clearAllMocks();
});

describe('shouldRetryError', () => {
  it('retries on network error', () => {
    const err = new Error('Failed to fetch');
    expect(shouldRetryError(err)).toBe(true);
  });

  it('retries on NetworkError name', () => {
    const err = new Error('something');
    err.name = 'NetworkError';
    expect(shouldRetryError(err)).toBe(true);
  });

  it('retries on 500 status', () => {
    expect(shouldRetryError(new Error('HTTP 500'))).toBe(true);
  });

  it('retries on 502 status', () => {
    expect(shouldRetryError(new Error('HTTP 502'))).toBe(true);
  });

  it('retries on 503 status', () => {
    expect(shouldRetryError(new Error('HTTP 503'))).toBe(true);
  });

  it('does not retry on 401', () => {
    expect(shouldRetryError(new Error('HTTP 401'))).toBe(false);
  });

  it('does not retry on 403', () => {
    expect(shouldRetryError(new Error('HTTP 403'))).toBe(false);
  });

  it('does not retry on 404', () => {
    expect(shouldRetryError(new Error('HTTP 404'))).toBe(false);
  });

  it('retries on timeout', () => {
    expect(shouldRetryError(new Error('timeout'))).toBe(true);
  });

  it('does not retry on invalid order number', () => {
    expect(shouldRetryError(new Error('Ungültige Bestellnummer'))).toBe(false);
  });

  it('does not retry on already active download', () => {
    expect(shouldRetryError(new Error('Download bereits aktiv'))).toBe(false);
  });
});

describe('handleExportError', () => {
  it('returns German network error message', () => {
    const err = new Error('Failed to fetch');
    const msg = handleExportError(err, '123456');
    expect(msg).toContain('Bestellung 123456');
    expect(msg).toContain('Netzwerkfehler');
  });

  it('returns auth error for 401', () => {
    const msg = handleExportError(new Error('HTTP 401'), '123456');
    expect(msg).toContain('Authentifizierung fehlgeschlagen');
  });

  it('returns not found for 404', () => {
    const msg = handleExportError(new Error('HTTP 404'), '123456');
    expect(msg).toContain('nicht gefunden');
  });

  it('returns server error for 500', () => {
    const msg = handleExportError(new Error('HTTP 500'), '123456');
    expect(msg).toContain('Server-Fehler');
  });

  it('returns generic message for unknown errors', () => {
    const msg = handleExportError(new Error('something weird'), '123456');
    expect(msg).toContain('Export fehlgeschlagen');
    expect(msg).toContain('something weird');
  });
});

describe('fetchOrderViaGraphQL', () => {
  const mockOrder = {
    customerOrderNumber: 'C123',
    orderNumber: '123456',
    orderLines: [],
  };

  const makeSuccessResponse = () => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data: { site: { commerce: { orders: { get: mockOrder } } } },
    }),
  });

  it('fetches and returns order data', async () => {
    mockGmFetch.mockResolvedValue(makeSuccessResponse());
    const result = await fetchOrderViaGraphQL('123456', 'mySite');
    expect(result).toEqual(mockOrder);
    expect(mockGmFetch).toHaveBeenCalledOnce();
  });

  it('caches successful responses', async () => {
    mockGmFetch.mockResolvedValue(makeSuccessResponse());
    await fetchOrderViaGraphQL('123456', 'mySite');
    const result = await fetchOrderViaGraphQL('123456', 'mySite');
    expect(result).toEqual(mockOrder);
    expect(mockGmFetch).toHaveBeenCalledOnce(); // only 1 call, second from cache
  });

  it('throws on invalid order number', async () => {
    await expect(fetchOrderViaGraphQL('123', 'mySite')).rejects.toThrow('Ungültige Bestellnummer');
  });

  it('throws on concurrent download of same order', async () => {
    State.activeDownloads.add('123456');
    await expect(fetchOrderViaGraphQL('123456', 'mySite')).rejects.toThrow('Download bereits aktiv');
  });

  it('throws on empty GraphQL response', async () => {
    mockGmFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { site: { commerce: { orders: { get: null } } } } }),
    });
    await expect(fetchOrderViaGraphQL('123456', 'mySite')).rejects.toThrow('GraphQL: leere Antwort');
  });

  it('cleans up activeDownloads on error', async () => {
    mockGmFetch.mockRejectedValue(new Error('network fail'));
    await expect(fetchOrderViaGraphQL('123456', 'mySite')).rejects.toThrow('network fail');
    expect(State.activeDownloads.has('123456')).toBe(false);
  });

  it('throws on non-ok HTTP response', async () => {
    mockGmFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    await expect(fetchOrderViaGraphQL('123456', 'mySite')).rejects.toThrow('GraphQL HTTP 500');
  });
});
