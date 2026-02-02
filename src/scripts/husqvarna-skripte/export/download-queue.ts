import { ICONS, getStatusIcon } from '@lib/ui';
import { sanitizeFilename } from '@lib/utils';
import { generateCsv, downloadCsvBlob } from '@lib/csv';
import { Config } from '../config';
import { State, QueueItem } from '../state';
import { fetchOrderViaGraphQL, shouldRetryError, handleExportError } from './graphql';
import { mapGraphQLToRow, prepareCsvDataToExport } from './csv-transform';
import { updateStatusItem } from '../ui/status-display';
import { extractSiteName } from '../dom/extract';


export function isMaxConcurrentDownloadsReached(): boolean {
  return State.activeDownloads.size >= Config.download.MAX_CONCURRENT_DOWNLOADS;
}

export function processDownloadQueue(): void {
  if (State.downloadQueue.length === 0 || isMaxConcurrentDownloadsReached()) return;
  const queueItem = State.downloadQueue.shift()!;
  startDownload(queueItem);
}

export function enqueueDownload(queueItem: QueueItem): void {
  if (State.activeDownloads.has(queueItem.orderNumber) ||
    State.downloadQueue.some(item => item.orderNumber === queueItem.orderNumber)) {
    return;
  }
  State.downloadQueue.push(queueItem);
  updateQueuedButtonState(queueItem);
  processDownloadQueue();
}

function updateQueuedButtonState(queueItem: QueueItem): void {
  const { $btn, iconSelector, textSelector } = queueItem;
  $btn.addClass('queued').attr('data-queued-state', 'true');
  $btn.find(iconSelector).html(ICONS.clock);
  const $text = $btn.find(textSelector);
  if ($text.length > 0) $text.text('In Warteschlange');
}

export function getButtonId(orderNumber: string): string {
  return `export-btn-${orderNumber}`;
}

export async function startDownload(queueItem: QueueItem): Promise<void> {
  const { orderNumber, siteName, filename, $btn, iconSelector, textSelector, retryAttempt = 1, isCustomOrderInput = false } = queueItem;

  const buttonId = getButtonId(orderNumber);
  $btn.removeClass('queued error').removeAttr('data-queued-state data-error-state')
    .addClass('loading').attr('data-button-id', buttonId);

  const $icon = $btn.find(iconSelector);
  const $text = $btn.find(textSelector);

  $icon.html(ICONS.spinner);
  if ($text.length > 0) {
    $text.text(retryAttempt >= 2 ? `${Config.ui.LOADING_TEXT} (${retryAttempt})` : Config.ui.LOADING_TEXT);
  }

  if (isCustomOrderInput) {
    updateStatusItem(orderNumber, 'loading', retryAttempt >= 2 ? `Lädt... (Versuch ${retryAttempt})` : 'Lädt...');
  }

  try {
    const order = await fetchOrderViaGraphQL(orderNumber, siteName, retryAttempt);
    const innerOrderNumber = order.customerOrderNumber && order.customerOrderNumber !== '-' ? order.customerOrderNumber : order.orderNumber;
    const outerOrderNumber = order.orderNumber;

    const rows = (order.orderLines || []).map(mapGraphQLToRow);
    const csv = generateCsv(prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber));
    downloadCsvBlob(csv, filename);

    $btn.removeClass('loading').addClass('success').attr('data-success-state', 'true');
    $icon.html(ICONS.success);
    if ($text.length > 0) $text.text('Erfolgreich!');

    if (isCustomOrderInput) updateStatusItem(orderNumber, 'success', 'Erfolgreich heruntergeladen');

  } catch (error) {
    const err = error as Error;
    if (retryAttempt < Config.download.MAX_RETRY_ATTEMPTS && shouldRetryError(err)) {
      const nextAttempt = retryAttempt + 1;
      const delay = Config.timing.RETRY_DELAY_BASE * Math.pow(2, retryAttempt - 1);
      console.log(`Retry attempt ${nextAttempt} for order ${orderNumber} in ${delay}ms`);
      State.retryCounters.set(orderNumber, nextAttempt);
      setTimeout(() => startDownload({ ...queueItem, retryAttempt: nextAttempt }), delay);
      return;
    }

    const userMessage = handleExportError(err, orderNumber);
    State.retryCounters.delete(orderNumber);

    $btn.removeClass('loading').addClass('error').attr('data-error-state', 'true');
    $icon.html(ICONS.error);
    if ($text.length > 0) {
      $text.text(retryAttempt >= 2 ? `Fehler! (${retryAttempt}/${Config.download.MAX_RETRY_ATTEMPTS})` : 'Fehler!');
    }

    if (isCustomOrderInput) updateStatusItem(orderNumber, 'error', err.message || 'Fehler beim Download');
    console.error(userMessage);
  } finally {
    State.activeDownloads.delete(orderNumber);
    setTimeout(() => processDownloadQueue(), 100);
  }
}

export function createExportHandler(
  iconSelector: string,
  textSelector: string,
  orderNumber: string,
  filename: string,
  $btn: JQuery,
): (e: JQuery.ClickEvent) => void {
  return (e) => {
    e.preventDefault();
    if (State.activeDownloads.has(orderNumber)) return;

    if ($btn.hasClass('error') || $btn.attr('data-error-state') === 'true') {
      $btn.removeClass('error').removeAttr('data-error-state');
      State.retryCounters.delete(orderNumber);
    }
    if ($btn.hasClass('queued') || $btn.attr('data-queued-state') === 'true') {
      $btn.removeClass('queued').removeAttr('data-queued-state');
      const idx = State.downloadQueue.findIndex(item => item.orderNumber === orderNumber);
      if (idx !== -1) State.downloadQueue.splice(idx, 1);
    }

    const queueItem: QueueItem = {
      orderNumber,
      siteName: extractSiteName(),
      filename,
      $btn,
      iconSelector,
      textSelector,
      originalIcon: $btn.find(iconSelector).html() || '',
      originalText: $btn.find(textSelector).text() || '',
      retryAttempt: 1,
    };

    if (isMaxConcurrentDownloadsReached()) {
      enqueueDownload(queueItem);
    } else {
      startDownload(queueItem);
    }
  };
}
