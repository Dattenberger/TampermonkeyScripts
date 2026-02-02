import { fetchOrderViaGraphQL, shouldRetryError } from '../export/graphql';
import { Config } from '../config';
import { MergedState, MergedOrderEntry } from './merged-state';
import { extractSiteName } from '../dom/extract';

const MAX_CONCURRENT = Config.download.MAX_CONCURRENT_DOWNLOADS;
const MAX_RETRY_FULL = Config.download.MAX_RETRY_FULL;
const MAX_RETRY_TOTAL = Config.download.MAX_RETRY_TOTAL;

type StatusCallback = (orderNumber: string, entry: MergedOrderEntry) => void;

export async function startMergedDownloads(onStatusChange: StatusCallback): Promise<void> {
  if (MergedState.isDownloading) return;
  MergedState.isDownloading = true;

  const siteName = extractSiteName();
  const entries = Array.from(MergedState.selectedOrders.values()).filter(e => e.status !== 'success');

  // Process with concurrency limit
  const queue = [...entries];
  const active: Promise<void>[] = [];

  const processNext = async (): Promise<void> => {
    while (queue.length > 0) {
      const entry = queue.shift()!;
      await downloadSingleOrder(entry, siteName, onStatusChange);
    }
  };

  // Start up to MAX_CONCURRENT workers
  for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
    active.push(processNext());
  }

  await Promise.all(active);
  MergedState.isDownloading = false;
}

async function downloadSingleOrder(
  entry: MergedOrderEntry,
  siteName: string,
  onStatusChange: StatusCallback,
): Promise<void> {
  entry.status = 'loading';
  entry.retryAttempt = 1;
  onStatusChange(entry.orderNumber, entry);

  for (let attempt = 1; attempt <= MAX_RETRY_TOTAL; attempt++) {
    entry.retryAttempt = attempt;
    entry.status = 'loading';
    onStatusChange(entry.orderNumber, entry);

    const skipDeliveryLines = attempt > MAX_RETRY_FULL;

    try {
      const order = await fetchOrderViaGraphQL(entry.orderNumber, siteName, attempt, skipDeliveryLines);

      // Patch deliveryLines if lite query was used
      if (skipDeliveryLines && order.orderLines) {
        const todayISO = new Date().toISOString();
        for (const line of order.orderLines) {
          if (!line.deliveryLines || line.deliveryLines.length === 0) {
            line.deliveryLines = [{
              deliveryQuantity: line.requestedQuantity,
              promisedDispatchDate: todayISO,
              shipmentInfos: [],
            }];
          }
        }
        entry.usedLiteQuery = true;
      }

      entry.orderData = order;
      entry.customerOrderNumber = order.customerOrderNumber || '';
      if (!entry.userOverrideOrderNumber) {
        entry.userOverrideOrderNumber = entry.customerOrderNumber;
      }
      entry.status = 'success';
      entry.errorMessage = '';
      onStatusChange(entry.orderNumber, entry);
      return;
    } catch (error) {
      const err = error as Error;
      entry.errorMessage = err.message || 'Unbekannter Fehler';

      // Check if retryable
      const isRetryable = shouldRetryError(err);
      if (!isRetryable || attempt >= MAX_RETRY_TOTAL) {
        entry.status = 'error';
        onStatusChange(entry.orderNumber, entry);
        return;
      }

      // Wait with exponential backoff before next attempt
      const delay = Config.timing.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

