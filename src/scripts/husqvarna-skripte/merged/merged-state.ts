import { store, type ExportMode } from '../storage';

export type MergedOrderStatus = 'pending' | 'loading' | 'success' | 'error';

export interface MergedOrderEntry {
  orderNumber: string;
  status: MergedOrderStatus;
  retryAttempt: number;
  customerOrderNumber: string;
  userOverrideOrderNumber: string;
  orderData: any | null;
  errorMessage: string;
  usedLiteQuery: boolean;
}

export const MergedState = {
  get mode(): ExportMode { return store.get('mode'); },
  set mode(v: ExportMode) { store.set('mode', v); },
  selectedOrders: new Map<string, MergedOrderEntry>(),
  isDownloading: false,
  modalOpen: false,
};

export function createMergedOrderEntry(orderNumber: string): MergedOrderEntry {
  return {
    orderNumber,
    status: 'pending',
    retryAttempt: 0,
    customerOrderNumber: '',
    userOverrideOrderNumber: '',
    orderData: null,
    errorMessage: '',
    usedLiteQuery: false,
  };
}

export function resetMergedState(): void {
  MergedState.selectedOrders.clear();
  MergedState.isDownloading = false;
  MergedState.modalOpen = false;
}
