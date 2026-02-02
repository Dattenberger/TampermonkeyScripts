import { mapGraphQLToRow, prepareCsvDataToExport } from '../export/csv-transform';
import { generateCsv, downloadCsvBlob } from '@lib/csv';
import { MergedState, MergedOrderEntry } from './merged-state';

export interface MergedExportResult {
  exported: number;
  skipped: number;
  skippedOrders: string[];
}

export function exportMergedCsv(): MergedExportResult {
  const allRows: ReturnType<typeof prepareCsvDataToExport> = [];
  const skippedOrders: string[] = [];
  let exported = 0;

  for (const entry of MergedState.selectedOrders.values()) {
    if (entry.status !== 'success' || !entry.orderData) {
      skippedOrders.push(entry.orderNumber);
      continue;
    }

    const order = entry.orderData;
    const internalNumber = entry.userOverrideOrderNumber.trim()
      || entry.customerOrderNumber
      || entry.orderNumber;
    const outerNumber = order.orderNumber || entry.orderNumber;

    const rows = (order.orderLines || []).map(mapGraphQLToRow);
    const csvRows = prepareCsvDataToExport(rows, internalNumber, outerNumber);
    allRows.push(...csvRows);
    exported++;
  }

  if (allRows.length > 0) {
    const csv = generateCsv(allRows);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsvBlob(csv, `Sammelexport_${today}.csv`);
  }

  return { exported, skipped: skippedOrders.length, skippedOrders };
}

export function getSuccessfulCount(): number {
  let count = 0;
  for (const entry of MergedState.selectedOrders.values()) {
    if (entry.status === 'success') count++;
  }
  return count;
}

export function getFailedOrPendingOrders(): string[] {
  const result: string[] = [];
  for (const entry of MergedState.selectedOrders.values()) {
    if (entry.status !== 'success') result.push(entry.orderNumber);
  }
  return result;
}
