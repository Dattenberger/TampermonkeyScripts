import { ICONS, getStatusIcon } from '@lib/ui';
import { MergedState, MergedOrderEntry, MergedOrderStatus } from '../merged/merged-state';
import { startMergedDownloads } from '../merged/merged-download';
import { exportMergedCsv, getFailedOrPendingOrders } from '../merged/merged-csv';
import { store } from '../storage';

export function openMergedDownloadModal(): void {
  if (MergedState.modalOpen) return;
  MergedState.modalOpen = true;

  const entries = Array.from(MergedState.selectedOrders.values());

  const modal = document.createElement('div');
  modal.className = 'datte-merged-modal';
  modal.innerHTML = `
    <div class="datte-merged-dialog">
      <div class="datte-merged-header">
        <span class="datte-merged-title">Sammel-Export (${entries.length} Bestellungen)</span>
        <button class="datte-merged-close-btn" title="Schließen">${ICONS.error}</button>
      </div>
      <div class="datte-merged-body">
        <div id="datte-merged-warning" class="datte-merged-warning" style="display:none;"></div>
        <table class="datte-merged-table">
          <thead>
            <tr>
              <th>Auftragsnr.</th>
              <th>Interne Bestellnr.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="datte-merged-tbody">
            ${entries.map(e => renderRow(e)).join('')}
          </tbody>
        </table>
      </div>
      <div class="datte-merged-footer">
        <button class="datte-confirm-btn datte-confirm-btn-cancel" id="datte-merged-close">Schließen</button>
        <div style="display:flex;gap:12px;">
          <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-merged-csv-export" style="background:#2563eb;border-color:#2563eb;">CSV-Export</button>
          <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-merged-start">Download starten</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind input change handlers
  entries.forEach(entry => {
    const input = document.getElementById(`datte-merged-input-${entry.orderNumber}`) as HTMLInputElement | null;
    if (input) {
      input.addEventListener('input', () => {
        entry.userOverrideOrderNumber = input.value;
        const overrides = store.get('orderNameOverrides');
        overrides.set(entry.orderNumber, input.value);
        store.set('orderNameOverrides', overrides);
      });
    }
  });

  // Close handler
  const closeModal = () => {
    if (MergedState.isDownloading) {
      if (!confirm('Downloads laufen noch. Wirklich schließen?')) return;
    }
    document.removeEventListener('keydown', handleKey);
    modal.remove();
    MergedState.modalOpen = false;
  };

  modal.querySelector('.datte-merged-close-btn')!.addEventListener('click', closeModal);
  document.getElementById('datte-merged-close')!.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Escape key
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleKey);
    }
  };
  document.addEventListener('keydown', handleKey);

  // Start download handler
  document.getElementById('datte-merged-start')!.addEventListener('click', async () => {
    const startBtn = document.getElementById('datte-merged-start') as HTMLButtonElement;
    startBtn.disabled = true;
    startBtn.textContent = 'Downloads laufen...';

    await startMergedDownloads((orderNumber, entry) => {
      updateModalRow(orderNumber, entry);
    });

    startBtn.textContent = 'Download starten';
    startBtn.disabled = false;
  });

  // CSV Export handler
  document.getElementById('datte-merged-csv-export')!.addEventListener('click', () => {
    const failedOrders = getFailedOrPendingOrders();
    const warningEl = document.getElementById('datte-merged-warning')!;

    if (failedOrders.length > 0) {
      warningEl.style.display = 'block';
      warningEl.innerHTML = `
        <strong>⚠ Nicht alle Bestellungen wurden heruntergeladen.</strong><br>
        Folgende fehlen: <strong>${failedOrders.join(', ')}</strong><br>
        <div class="datte-merged-warning-actions">
          <button class="datte-confirm-btn datte-confirm-btn-cancel" id="datte-merged-warning-cancel">Abbrechen</button>
          <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-merged-warning-confirm" style="background:#e67e22;border-color:#e67e22;">Trotzdem exportieren</button>
        </div>
      `;
      document.getElementById('datte-merged-warning-cancel')!.addEventListener('click', () => {
        warningEl.style.display = 'none';
      });
      document.getElementById('datte-merged-warning-confirm')!.addEventListener('click', () => {
        warningEl.style.display = 'none';
        exportMergedCsv();
      });
    } else {
      exportMergedCsv();
    }
  });
}

function renderRow(entry: MergedOrderEntry): string {
  const overrides = store.get('orderNameOverrides');
  const savedOverride = overrides.get(entry.orderNumber);
  if (savedOverride !== undefined) {
    entry.userOverrideOrderNumber = savedOverride;
  }

  const statusClass = `status-${entry.status}`;
  const statusText = getStatusText(entry);
  const icon = getStatusIcon(entry.status);

  return `
    <tr id="datte-merged-row-${entry.orderNumber}">
      <td><strong>${entry.orderNumber}</strong></td>
      <td><input type="text" id="datte-merged-input-${entry.orderNumber}"
           value="${entry.userOverrideOrderNumber}"
           placeholder="Wird nach Download gefüllt"></td>
      <td><span class="datte-merged-status ${statusClass}">
        <span class="datte-merged-status-icon">${icon}</span>
        <span class="datte-merged-status-text">${statusText}</span>
      </span></td>
    </tr>
  `;
}

function updateModalRow(orderNumber: string, entry: MergedOrderEntry): void {
  const row = document.getElementById(`datte-merged-row-${orderNumber}`);
  if (!row) return;

  // Update status badge
  const statusSpan = row.querySelector('.datte-merged-status') as HTMLElement;
  if (statusSpan) {
    statusSpan.className = `datte-merged-status status-${entry.status}`;
    const iconEl = statusSpan.querySelector('.datte-merged-status-icon');
    const textEl = statusSpan.querySelector('.datte-merged-status-text');
    if (iconEl) iconEl.innerHTML = getStatusIcon(entry.status);
    if (textEl) textEl.textContent = getStatusText(entry);
  }

  // Update input if customerOrderNumber was fetched and user hasn't typed yet
  const input = document.getElementById(`datte-merged-input-${orderNumber}`) as HTMLInputElement | null;
  if (input && entry.status === 'success' && !input.value) {
    const autoValue = entry.userOverrideOrderNumber || entry.customerOrderNumber;
    input.value = autoValue;
    if (autoValue) {
      const overrides = store.get('orderNameOverrides');
      overrides.set(entry.orderNumber, autoValue);
      store.set('orderNameOverrides', overrides);
    }
  }
}

function getStatusText(entry: MergedOrderEntry): string {
  switch (entry.status) {
    case 'pending': return 'Ausstehend';
    case 'loading': return entry.retryAttempt > 1 ? `Lade... (${entry.retryAttempt}/6)` : 'Lade...';
    case 'success': return entry.usedLiteQuery ? 'Erfolgreich (ohne Lieferzeiten)' : 'Erfolgreich';
    case 'error': return `Fehler (${entry.retryAttempt}/6)`;
    default: return '';
  }
}
