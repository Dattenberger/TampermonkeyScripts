import { MergedState } from '../merged/merged-state';
import { openMergedDownloadModal } from './merged-modal';

let barElement: HTMLElement | null = null;

export function createDownloadAllBar(container: Element): void {
  if (document.getElementById('datte-download-all-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'datte-download-all-bar';
  bar.className = 'datte-download-all-bar';
  bar.style.display = MergedState.mode === 'merged' ? 'flex' : 'none';
  bar.innerHTML = `
    <span class="datte-download-all-count" id="datte-download-all-count">
      0 Bestellungen ausgewählt
    </span>
    <div class="datte-download-all-actions">
      <button class="datte-confirm-btn datte-confirm-btn-cancel" id="datte-clear-selection">
        Auswahl leeren
      </button>
      <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-download-all-btn" disabled>
        Download All
      </button>
    </div>
  `;

  // Insert after mode toggle or at top
  const modeToggle = container.querySelector('.datte-mode-toggle');
  if (modeToggle && modeToggle.nextSibling) {
    container.insertBefore(bar, modeToggle.nextSibling);
  } else {
    container.appendChild(bar);
  }

  barElement = bar;

  // Clear selection
  document.getElementById('datte-clear-selection')!.addEventListener('click', () => {
    MergedState.selectedOrders.clear();
    updateDownloadAllBar();
    // Reset all add-buttons to unselected state
    document.querySelectorAll('.add-btn.selected').forEach(btn => {
      btn.classList.remove('selected');
      const icon = btn.querySelector('.add-icon');
      const text = btn.querySelector('.add-text');
      if (icon) icon.innerHTML = getPlusIcon();
      if (text) text.textContent = 'Hinzufügen';
    });
  });

  // Download All
  document.getElementById('datte-download-all-btn')!.addEventListener('click', () => {
    if (MergedState.selectedOrders.size === 0) return;
    openMergedDownloadModal();
  });
}

export function updateDownloadAllBar(): void {
  const count = MergedState.selectedOrders.size;
  const countEl = document.getElementById('datte-download-all-count');
  if (countEl) {
    countEl.textContent = `${count} Bestellung${count !== 1 ? 'en' : ''} ausgewählt`;
  }
  const btn = document.getElementById('datte-download-all-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = count === 0;
  }
}

export function showDownloadAllBar(): void {
  const bar = barElement || document.getElementById('datte-download-all-bar');
  if (bar) bar.style.display = 'flex';
}

export function hideDownloadAllBar(): void {
  const bar = barElement || document.getElementById('datte-download-all-bar');
  if (bar) bar.style.display = 'none';
}

function getPlusIcon(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14"/></svg>';
}
