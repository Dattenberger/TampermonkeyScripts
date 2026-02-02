import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MergedState, createMergedOrderEntry, resetMergedState } from '../merged-state';

vi.mock('../../export/graphql', () => ({
  fetchOrderViaGraphQL: vi.fn(),
  shouldRetryError: vi.fn(),
}));

vi.mock('../../dom/extract', () => ({
  extractSiteName: vi.fn(() => 'testSite'),
}));

import { fetchOrderViaGraphQL, shouldRetryError } from '../../export/graphql';
import { startMergedDownloads } from '../merged-download';

const mockFetch = vi.mocked(fetchOrderViaGraphQL);
const mockShouldRetry = vi.mocked(shouldRetryError);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resetMergedState();
});

afterEach(() => {
  vi.useRealTimers();
  resetMergedState();
});

function makeOrderResponse(orderNumber: string) {
  return {
    orderNumber,
    customerOrderNumber: `CUST-${orderNumber}`,
    orderLines: [
      {
        requestedQuantity: 1,
        deliveryLines: [{ deliveryQuantity: 1, promisedDispatchDate: '2025-01-01', shipmentInfos: [] }],
      },
    ],
  };
}

describe('startMergedDownloads', () => {
  it('calls fetchOrderViaGraphQL for each pending order', async () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));
    MergedState.selectedOrders.set('B', createMergedOrderEntry('B'));

    mockFetch.mockImplementation(async (orderNumber) => makeOrderResponse(orderNumber));

    const cb = vi.fn();
    await startMergedDownloads(cb);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith('A', 'testSite', 1, false);
    expect(mockFetch).toHaveBeenCalledWith('B', 'testSite', 1, false);
  });

  it('retries 1-3 use full query, 4-6 use lite query', async () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));

    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount < 6) throw new Error('server error 500');
      return makeOrderResponse('A');
    });
    mockShouldRetry.mockReturnValue(true);

    const cb = vi.fn();
    const downloadPromise = startMergedDownloads(cb);

    // Advance through all retry delays
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(60000);
    }

    await downloadPromise;

    // Verify calls: attempts 1-3 have skipDeliveryLines=false, 4-6 have true
    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'A', 'testSite', 1, false);
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'A', 'testSite', 2, false);
    expect(mockFetch).toHaveBeenNthCalledWith(3, 'A', 'testSite', 3, false);
    expect(mockFetch).toHaveBeenNthCalledWith(4, 'A', 'testSite', 4, true);
    expect(mockFetch).toHaveBeenNthCalledWith(5, 'A', 'testSite', 5, true);
    expect(mockFetch).toHaveBeenNthCalledWith(6, 'A', 'testSite', 6, true);
  });

  it('on lite-query success, deliveryLines are patched with today date', async () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));

    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount <= 3) throw new Error('server error 500');
      // Return order without deliveryLines (lite query)
      return {
        orderNumber: 'A',
        customerOrderNumber: 'CUST-A',
        orderLines: [
          { requestedQuantity: 5, deliveryLines: [] },
        ],
      };
    });
    mockShouldRetry.mockReturnValue(true);

    const cb = vi.fn();
    const downloadPromise = startMergedDownloads(cb);

    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(60000);
    }

    await downloadPromise;

    const entry = MergedState.selectedOrders.get('A')!;
    expect(entry.status).toBe('success');
    expect(entry.usedLiteQuery).toBe(true);
    expect(entry.orderData.orderLines[0].deliveryLines).toHaveLength(1);
    expect(entry.orderData.orderLines[0].deliveryLines[0].deliveryQuantity).toBe(5);
  });

  it('status callback fires with correct states on success', async () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));
    mockFetch.mockResolvedValue(makeOrderResponse('A'));

    const statuses: string[] = [];
    const cb = vi.fn((_, entry) => {
      statuses.push(entry.status);
    });
    await startMergedDownloads(cb);

    expect(statuses).toContain('loading');
    expect(statuses[statuses.length - 1]).toBe('success');
  });

  it('status callback fires with error on failure', async () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));
    mockFetch.mockRejectedValue(new Error('HTTP 404'));
    mockShouldRetry.mockReturnValue(false);

    const cb = vi.fn();
    await startMergedDownloads(cb);

    const statuses = cb.mock.calls.map((c: any[]) => c[1].status);
    expect(statuses[statuses.length - 1]).toBe('error');
  });

  it('non-retryable errors stop immediately', async () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));
    mockFetch.mockRejectedValue(new Error('HTTP 404'));
    mockShouldRetry.mockReturnValue(false);

    const cb = vi.fn();
    await startMergedDownloads(cb);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(MergedState.selectedOrders.get('A')!.status).toBe('error');
  });

  it('concurrent limit is respected (max 2 simultaneous)', async () => {
    // Create 4 orders
    for (const n of ['A', 'B', 'C', 'D']) {
      MergedState.selectedOrders.set(n, createMergedOrderEntry(n));
    }

    let concurrentCount = 0;
    let maxConcurrent = 0;

    mockFetch.mockImplementation(async (orderNumber) => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      // Simulate async work
      await new Promise(r => setTimeout(r, 100));
      concurrentCount--;
      return makeOrderResponse(orderNumber);
    });

    const cb = vi.fn();
    const downloadPromise = startMergedDownloads(cb);

    // Advance timers to allow all downloads to complete
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(200);
    }

    await downloadPromise;

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('already-successful orders are skipped', async () => {
    const successEntry = createMergedOrderEntry('A');
    successEntry.status = 'success';
    MergedState.selectedOrders.set('A', successEntry);
    MergedState.selectedOrders.set('B', createMergedOrderEntry('B'));

    mockFetch.mockImplementation(async (orderNumber) => makeOrderResponse(orderNumber));

    const cb = vi.fn();
    await startMergedDownloads(cb);

    // Only B should be fetched
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('B', 'testSite', 1, false);
  });
});
