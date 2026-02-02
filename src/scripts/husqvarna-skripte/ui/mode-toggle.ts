import { MergedState } from '../merged/merged-state';
import { replaceAllRowButtons } from './export-buttons';
import { updateDownloadAllBar, showDownloadAllBar, hideDownloadAllBar } from './download-all-bar';

export function createModeToggle(container: Element): void {
  // Don't create if already exists
  if (document.querySelector('.datte-mode-toggle')) return;

  const toggle = document.createElement('div');
  toggle.className = 'datte-mode-toggle';
  toggle.innerHTML = `
    <button class="datte-mode-btn ${MergedState.mode === 'single' ? 'active' : ''}" data-mode="single">Einzelmodus</button>
    <button class="datte-mode-btn ${MergedState.mode === 'merged' ? 'active' : ''}" data-mode="merged">Sammelmodus</button>
  `;

  // Insert at the very top of the container
  container.insertBefore(toggle, container.firstChild);

  // Event delegation
  toggle.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const mode = target.dataset.mode as 'single' | 'merged' | undefined;
    if (!mode || mode === MergedState.mode) return;

    MergedState.mode = mode;

    // Update active states
    toggle.querySelectorAll('.datte-mode-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });

    // Swap buttons on order rows
    replaceAllRowButtons();

    // Show/hide download all bar
    if (mode === 'merged') {
      showDownloadAllBar();
      updateDownloadAllBar();
    } else {
      hideDownloadAllBar();
    }
  });
}

export function getCurrentMode(): 'single' | 'merged' {
  return MergedState.mode;
}
