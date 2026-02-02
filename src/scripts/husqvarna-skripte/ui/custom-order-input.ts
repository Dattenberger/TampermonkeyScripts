import { parseOrderNumbers, sanitizeFilename } from '@lib/utils';
import { ICONS } from '@lib/ui';
import { showConfirmModal } from '@lib/ui';
import { Config } from '../config';
import { State, QueueItem } from '../state';
import { extractSiteName } from '../dom/extract';
import { isMaxConcurrentDownloadsReached, enqueueDownload, startDownload } from '../export/download-queue';
import { createStatusItem, clearAllStatusItems } from './status-display';


export function createCustomOrderInputUI(orderListPage: Element): void {
  console.log('[CustomOrderInput] Creating custom order input UI');

  const ordersDiv = document.createElement('div');
  ordersDiv.id = 'orders';
  ordersDiv.className = 'datte-custom-order-container';
  ordersDiv.innerHTML = `
    <div class="datte-custom-order-group">
      <div class="datte-custom-order-wrapper">
        <label for="datte-custom-order-number" class="datte-custom-order-label">
          <span>JTL-CSV-Export für mehrere Auftragsnummern</span>
          <span class="datte-muted">(Enter drücken)</span>
        </label>
        <input type="text" id="datte-custom-order-number" class="datte-custom-order-input"
               placeholder="Auftragsnummer(n) - mehrere mit Leerzeichen, Komma oder Semikolon trennen" autocomplete="off">
        <div class="datte-custom-order-error" id="datte-custom-order-error">Fehlerhafte Eingabe: Nur Zahlen sind erlaubt</div>
      </div>
      <button class="datte-custom-order-btn" id="datte-custom-order-download">
        <span class="datte-custom-order-icon" aria-hidden="true">${ICONS.download}</span>
        <span class="datte-custom-order-text">Herunterladen</span>
      </button>
    </div>
    <div class="datte-download-status-container" id="datte-download-status-container" style="display: none;">
      <div class="datte-download-status-header">
        <span class="datte-download-status-title">Downloads</span>
        <button class="datte-download-status-clear-btn" id="datte-download-status-clear" title="Alle leeren">
          ${ICONS.close} Leeren
        </button>
      </div>
      <div class="datte-download-status-list" id="datte-download-status-list"></div>
    </div>
  `;

  orderListPage.insertBefore(ordersDiv, orderListPage.firstChild);

  const input = document.getElementById('datte-custom-order-number') as HTMLInputElement;
  const downloadBtn = document.getElementById('datte-custom-order-download')!;
  const errorMsg = document.getElementById('datte-custom-order-error')!;
  const clearBtn = document.getElementById('datte-download-status-clear');

  if (clearBtn) clearBtn.addEventListener('click', () => clearAllStatusItems());

  function validateInput() {
    const value = input.value.trim();
    if (value.length === 0) {
      input.classList.remove('error');
      errorMsg.classList.remove('show');
      return null;
    }
    const parsed = parseOrderNumbers(value);
    if (parsed.invalid.length > 0) {
      input.classList.add('error');
      errorMsg.textContent = `Fehlerhafte Eingabe: ${parsed.invalid.join(', ')} - nur Zahlen erlaubt`;
      errorMsg.classList.add('show');
      return null;
    }
    if (parsed.valid.length > Config.business.MAX_MULTI_ORDER_LIMIT) {
      input.classList.add('error');
      errorMsg.textContent = `Maximum ${Config.business.MAX_MULTI_ORDER_LIMIT} Aufträge gleichzeitig erlaubt (${parsed.valid.length} eingegeben)`;
      errorMsg.classList.add('show');
      return null;
    }
    input.classList.remove('error');
    errorMsg.classList.remove('show');
    return parsed;
  }

  async function handleCustomOrderDownload() {
    const parsed = validateInput();
    if (!parsed || parsed.valid.length === 0) return;

    const orderNumbers = parsed.valid;
    if (orderNumbers.length > 1) {
      const confirmed = await showConfirmModal(orderNumbers, input);
      if (!confirmed) return;
    }

    input.value = '';
    input.classList.remove('error');
    errorMsg.classList.remove('show');

    const siteName = extractSiteName();
    orderNumbers.forEach(orderNumber => {
      const filename = sanitizeFilename(orderNumber);
      createStatusItem(orderNumber, 'pending', 'In Warteschlange');

      const dummyBtn = document.createElement('button');
      dummyBtn.style.display = 'none';
      dummyBtn.innerHTML = '<span class="datte-custom-order-icon"></span><span class="datte-custom-order-text"></span>';

      const queueItem: QueueItem = {
        orderNumber, siteName, filename,
        $btn: $(dummyBtn),
        iconSelector: '.datte-custom-order-icon',
        textSelector: '.datte-custom-order-text',
        originalIcon: '', originalText: '',
        retryAttempt: 1,
        isCustomOrderInput: true,
      };

      if (isMaxConcurrentDownloadsReached()) {
        enqueueDownload(queueItem);
      } else {
        startDownload(queueItem);
      }
    });
    input.focus();
  }

  input.addEventListener('input', () => {
    if (input.value.trim().length > 0) validateInput();
    else { input.classList.remove('error'); errorMsg.classList.remove('show'); }
  });
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomOrderDownload(); } });
  downloadBtn.addEventListener('click', (e) => { e.preventDefault(); handleCustomOrderDownload(); });
}

export function setupCustomOrderInputObserver(): void {
  const existing = document.querySelector('[data-testid="order-list-page"]');
  if (existing && !document.querySelector('.datte-custom-order-container')) {
    createCustomOrderInputUI(existing);
    return;
  }

  const observer = new MutationObserver(() => {
    const orderListPage = document.querySelector('[data-testid="order-list-page"]');
    if (orderListPage && !document.querySelector('.datte-custom-order-container')) {
      createCustomOrderInputUI(orderListPage);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
