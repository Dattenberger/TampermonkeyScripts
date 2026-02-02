import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MergedState, createMergedOrderEntry, resetMergedState } from '../merged-state';

vi.mock('@lib/csv', () => ({
  generateCsv: vi.fn(() => 'csv-content'),
  downloadCsvBlob: vi.fn(),
}));

import { generateCsv, downloadCsvBlob } from '@lib/csv';
import { exportMergedCsv, getFailedOrPendingOrders, getSuccessfulCount } from '../merged-csv';

const mockGenerateCsv = vi.mocked(generateCsv);
const mockDownloadCsvBlob = vi.mocked(downloadCsvBlob);

function makeOrder(orderNumber: string, customerOrderNumber: string) {
  return {
    orderNumber,
    customerOrderNumber,
    orderLines: [
      {
        unformattedArticleNumber: 'ART001',
        customerOrderLineReference: '',
        ecomArticleDescription: 'Test Article',
        requestedQuantity: 2,
        requestedDispatchDate: '2025-01-15',
        totalGrossPrice: 100,
        totalNetPrice: 80,
        article: { id: 'ART001', name: 'Test Article', articleDescription: 'Desc' },
        deliveryLines: [
          {
            deliveryQuantity: 2,
            promisedDispatchDate: '2025-01-20',
            shipmentInfos: [],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  resetMergedState();
});

describe('exportMergedCsv', () => {
  it('with all successful orders generates CSV and returns correct counts', () => {
    const e1 = createMergedOrderEntry('100001');
    e1.status = 'success';
    e1.orderData = makeOrder('100001', 'CUST-1');
    e1.customerOrderNumber = 'CUST-1';

    const e2 = createMergedOrderEntry('100002');
    e2.status = 'success';
    e2.orderData = makeOrder('100002', 'CUST-2');
    e2.customerOrderNumber = 'CUST-2';

    MergedState.selectedOrders.set('100001', e1);
    MergedState.selectedOrders.set('100002', e2);

    const result = exportMergedCsv();

    expect(result.exported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.skippedOrders).toEqual([]);
    expect(mockGenerateCsv).toHaveBeenCalledOnce();
    expect(mockDownloadCsvBlob).toHaveBeenCalledOnce();
  });

  it('with mixed success/error only exports successful, returns correct skipped list', () => {
    const e1 = createMergedOrderEntry('100001');
    e1.status = 'success';
    e1.orderData = makeOrder('100001', 'CUST-1');
    e1.customerOrderNumber = 'CUST-1';

    const e2 = createMergedOrderEntry('100002');
    e2.status = 'error';

    MergedState.selectedOrders.set('100001', e1);
    MergedState.selectedOrders.set('100002', e2);

    const result = exportMergedCsv();

    expect(result.exported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedOrders).toEqual(['100002']);
    expect(mockGenerateCsv).toHaveBeenCalledOnce();
    expect(mockDownloadCsvBlob).toHaveBeenCalledOnce();
  });

  it('with no successful orders does not download CSV', () => {
    const e1 = createMergedOrderEntry('100001');
    e1.status = 'error';
    const e2 = createMergedOrderEntry('100002');
    e2.status = 'pending';

    MergedState.selectedOrders.set('100001', e1);
    MergedState.selectedOrders.set('100002', e2);

    const result = exportMergedCsv();

    expect(result.exported).toBe(0);
    expect(result.skipped).toBe(2);
    expect(mockGenerateCsv).not.toHaveBeenCalled();
    expect(mockDownloadCsvBlob).not.toHaveBeenCalled();
  });

  it('order number fallback: userOverrideOrderNumber > customerOrderNumber > orderNumber', () => {
    // Case 1: userOverrideOrderNumber is set
    const e1 = createMergedOrderEntry('100001');
    e1.status = 'success';
    e1.orderData = makeOrder('100001', 'CUST-1');
    e1.customerOrderNumber = 'CUST-1';
    e1.userOverrideOrderNumber = 'OVERRIDE-1';
    MergedState.selectedOrders.set('100001', e1);

    exportMergedCsv();

    const rows1 = mockGenerateCsv.mock.calls[0][0] as any[];
    expect(rows1[0]['Interne Bestellnummer']).toBe('OVERRIDE-1');

    vi.clearAllMocks();
    resetMergedState();

    // Case 2: no override, falls back to customerOrderNumber
    const e2 = createMergedOrderEntry('100002');
    e2.status = 'success';
    e2.orderData = makeOrder('100002', 'CUST-2');
    e2.customerOrderNumber = 'CUST-2';
    e2.userOverrideOrderNumber = '';
    MergedState.selectedOrders.set('100002', e2);

    exportMergedCsv();

    const rows2 = mockGenerateCsv.mock.calls[0][0] as any[];
    expect(rows2[0]['Interne Bestellnummer']).toBe('CUST-2');

    vi.clearAllMocks();
    resetMergedState();

    // Case 3: no override, no customerOrderNumber, falls back to orderNumber
    const e3 = createMergedOrderEntry('100003');
    e3.status = 'success';
    e3.orderData = makeOrder('100003', '');
    e3.customerOrderNumber = '';
    e3.userOverrideOrderNumber = '';
    MergedState.selectedOrders.set('100003', e3);

    exportMergedCsv();

    const rows3 = mockGenerateCsv.mock.calls[0][0] as any[];
    expect(rows3[0]['Interne Bestellnummer']).toBe('100003');
  });
});

describe('getFailedOrPendingOrders', () => {
  it('returns correct list', () => {
    const e1 = createMergedOrderEntry('100001');
    e1.status = 'success';
    const e2 = createMergedOrderEntry('100002');
    e2.status = 'error';
    const e3 = createMergedOrderEntry('100003');
    e3.status = 'pending';

    MergedState.selectedOrders.set('100001', e1);
    MergedState.selectedOrders.set('100002', e2);
    MergedState.selectedOrders.set('100003', e3);

    expect(getFailedOrPendingOrders()).toEqual(['100002', '100003']);
  });
});

describe('getSuccessfulCount', () => {
  it('returns correct count', () => {
    const e1 = createMergedOrderEntry('100001');
    e1.status = 'success';
    const e2 = createMergedOrderEntry('100002');
    e2.status = 'error';
    const e3 = createMergedOrderEntry('100003');
    e3.status = 'success';

    MergedState.selectedOrders.set('100001', e1);
    MergedState.selectedOrders.set('100002', e2);
    MergedState.selectedOrders.set('100003', e3);

    expect(getSuccessfulCount()).toBe(2);
  });
});
