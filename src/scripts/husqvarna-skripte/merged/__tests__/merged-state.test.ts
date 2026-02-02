import { describe, it, expect, afterEach } from 'vitest';
import { createMergedOrderEntry, resetMergedState, MergedState } from '../merged-state';

afterEach(() => {
  resetMergedState();
  MergedState.mode = 'single';
});

describe('createMergedOrderEntry', () => {
  it('returns correct defaults', () => {
    const entry = createMergedOrderEntry('123456');
    expect(entry).toEqual({
      orderNumber: '123456',
      status: 'pending',
      retryAttempt: 0,
      customerOrderNumber: '',
      userOverrideOrderNumber: '',
      orderData: null,
      errorMessage: '',
      usedLiteQuery: false,
    });
  });
});

describe('resetMergedState', () => {
  it('clears all state', () => {
    MergedState.selectedOrders.set('A', createMergedOrderEntry('A'));
    MergedState.isDownloading = true;
    MergedState.modalOpen = true;

    resetMergedState();

    expect(MergedState.selectedOrders.size).toBe(0);
    expect(MergedState.isDownloading).toBe(false);
    expect(MergedState.modalOpen).toBe(false);
  });
});

describe('MergedState singleton', () => {
  it('modifications are visible across imports', () => {
    MergedState.mode = 'merged';
    MergedState.selectedOrders.set('X', createMergedOrderEntry('X'));

    // Same reference — changes visible
    expect(MergedState.mode).toBe('merged');
    expect(MergedState.selectedOrders.has('X')).toBe(true);
  });
});
