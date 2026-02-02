import { getStatusIcon } from '@lib/ui';
import { State } from '../state';

export function updateStatusDisplay(): void {
  const container = document.getElementById('datte-download-status-container');
  if (!container) return;
  container.style.display = State.downloadStatusItems.size > 0 ? 'block' : 'none';
}

export function clearAllStatusItems(): void {
  State.downloadStatusItems.forEach(item => item.remove());
  State.downloadStatusItems.clear();
  updateStatusDisplay();
}

export function createStatusItem(orderNumber: string, status: string = 'pending', _message: string = 'In Warteschlange'): void {
  const list = document.getElementById('datte-download-status-list');
  if (!list) return;

  if (State.downloadStatusItems.has(orderNumber)) {
    updateStatusItem(orderNumber, status, _message);
    return;
  }

  const item = document.createElement('div');
  item.className = `datte-download-status-item status-${status}`;
  item.id = `datte-status-${orderNumber}`;
  item.innerHTML = `
    <span class="datte-download-status-number">${orderNumber}</span>
    <span class="datte-download-status-icon">${getStatusIcon(status)}</span>
  `;

  list.appendChild(item);
  State.downloadStatusItems.set(orderNumber, item);
  updateStatusDisplay();
}

export function updateStatusItem(orderNumber: string, status: string, _message: string): void {
  const item = State.downloadStatusItems.get(orderNumber);
  if (!item) return;
  item.className = `datte-download-status-item status-${status}`;
  const iconEl = item.querySelector('.datte-download-status-icon');
  if (iconEl) iconEl.innerHTML = getStatusIcon(status);
}

export function removeStatusItem(orderNumber: string): void {
  const item = State.downloadStatusItems.get(orderNumber);
  if (!item) return;
  item.style.opacity = '0';
  setTimeout(() => {
    item.remove();
    State.downloadStatusItems.delete(orderNumber);
    updateStatusDisplay();
  }, 300);
}
