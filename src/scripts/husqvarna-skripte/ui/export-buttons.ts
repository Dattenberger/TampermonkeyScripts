import { sanitizeFilename, validateOrderNumber } from '@lib/utils';
import { ICONS } from '@lib/ui';
import { createExportHandler } from '../export/download-queue';
import { extractOrderNumber, extractOrderIdFromHref } from '../dom/extract';


export function attachExportButtonToNewLayout(): void {
  const $page = $('[data-testid="order-detail-page"]').first();
  if (!$page.length) return;
  const $bar = $page.find('h1').parent().find('h1 ~ div').first();
  if (!$bar.length || $bar.find('.export-btn').length) return;

  const orderNumber = extractOrderNumber();
  const filename = sanitizeFilename(orderNumber);

  const $btn = $(`
    <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}" title="Export CSV für JTL (API)">
      <span class="export-icon" aria-hidden="true">${ICONS.download}</span>
      <span class="export-text">Export CSV für JTL</span>
    </a>
  `);
  $btn.on('click', createExportHandler('.export-icon', '.export-text', orderNumber, filename, $btn));
  $bar.append($btn);
}

export function attachExportButtonToOldModal(): void {
  const $root = $('div#ui-modal-target');
  if (!$root.length) return;
  const $modal = $root.find('article').first();
  if (!$modal.length) return;
  const $header = $modal.find('header');
  const $headerDiv = $header.find('div').first();
  if (!$headerDiv.length || $header.find('.export-btn').length) return;

  $headerDiv.css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
  const orderNumber = extractOrderNumber();
  const filename = sanitizeFilename(orderNumber);

  const $btn = $(`
    <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}">
      <span class="export-icon" aria-hidden="true">${ICONS.download}</span>
      <span class="export-text">Export CSV für JTL</span>
    </a>
  `);
  $btn.on('click', createExportHandler('.export-icon', '.export-text', orderNumber, filename, $btn));
  $headerDiv.append($btn);
}

export function attachExportButtonsToOrderList(): void {
  const table = document.querySelector('[data-testid="order-list-page"] div[role="table"]');
  if (!table) return;

  const rows = table.querySelectorAll('div[role="row"]:not(.b2b-tm)');
  rows.forEach(row => {
    if (row.querySelector('.export-btn')) return;
    const detailLink = row.querySelector('a[data-testid="view-order-details-link"]') as HTMLAnchorElement | null;
    if (!detailLink) return;

    const orderNumber = extractOrderIdFromHref(detailLink.href);
    if (!orderNumber || !validateOrderNumber(orderNumber)) return;

    const filename = sanitizeFilename(orderNumber);
    const arrowCell = row.querySelector('div[role="cell"]:last-child');
    if (!arrowCell) return;

    const $downloadBtn = $(`
      <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}"
         title="CSV Export für Bestellung ${orderNumber}" style="margin-left: 12px;">
        <span class="export-icon" aria-hidden="true">${ICONS.download}</span>
        <span style="width: max-content" class="export-text">JTL Export</span>
      </a>
    `);
    $downloadBtn.on('click', createExportHandler('.export-icon', '.export-text', orderNumber, filename, $downloadBtn));
    $(arrowCell).append($downloadBtn);
  });
}
