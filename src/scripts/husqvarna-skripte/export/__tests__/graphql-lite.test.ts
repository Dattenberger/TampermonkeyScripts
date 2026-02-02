import { describe, it, expect, vi, beforeEach } from 'vitest';
import { State } from '@scripts/husqvarna-skripte/state';

vi.mock('@lib/fetch', () => ({ gmFetch: vi.fn() }));
import { gmFetch } from '@lib/fetch';
const mockGmFetch = vi.mocked(gmFetch);

import { fetchOrderViaGraphQL } from '../graphql';

beforeEach(() => {
  State.orderCache.clear();
  State.activeDownloads.clear();
  State.retryCounters.clear();
  vi.clearAllMocks();
});

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

describe('fetchOrderViaGraphQL query selection', () => {
  it('with skipDeliveryLines=true uses GQL_QUERY_LITE (no deliveryLines in query)', async () => {
    mockGmFetch.mockResolvedValue(makeSuccessResponse());

    await fetchOrderViaGraphQL('123456', 'mySite', 1, true);

    const body = JSON.parse(mockGmFetch.mock.calls[0]![1]!.body as string);
    expect(body.query).not.toContain('deliveryLines');
  });

  it('with skipDeliveryLines=false uses GQL_QUERY (contains deliveryLines)', async () => {
    mockGmFetch.mockResolvedValue(makeSuccessResponse());

    await fetchOrderViaGraphQL('123456', 'mySite', 1, false);

    const body = JSON.parse(mockGmFetch.mock.calls[0]![1]!.body as string);
    expect(body.query).toContain('deliveryLines');
  });
});
