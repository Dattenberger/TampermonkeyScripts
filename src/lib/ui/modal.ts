export function showConfirmModal(
  orderNumbers: string[],
  inputElement?: HTMLInputElement | null,
): Promise<boolean> {
  return new Promise((resolve) => {
    const sortedNumbers = [...orderNumbers].sort((a, b) => a.localeCompare(b));

    const modal = document.createElement('div');
    modal.className = 'datte-confirm-modal';
    modal.innerHTML = `
      <div class="datte-confirm-dialog">
        <div class="datte-confirm-header">
          <div class="datte-confirm-title">
            ${orderNumbers.length} Aufträge herunterladen?
            <span class="datte-muted">(Enter zum Bestätigen)</span>
          </div>
        </div>
        <div class="datte-confirm-body">
          <p>Möchten Sie wirklich ${orderNumbers.length} Aufträge herunterladen?</p>
          <div class="datte-confirm-order-list">${sortedNumbers.join(', ')}</div>
        </div>
        <div class="datte-confirm-actions">
          <button class="datte-confirm-btn datte-confirm-btn-cancel">Abbrechen</button>
          <button class="datte-confirm-btn datte-confirm-btn-ok">OK - Herunterladen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('.datte-confirm-btn-cancel')!;
    const okBtn = modal.querySelector('.datte-confirm-btn-ok')!;

    const cleanup = () => {
      document.removeEventListener('keydown', handleKeyPress);
      modal.remove();
    };

    const handleCancel = () => {
      cleanup();
      if (inputElement) inputElement.focus();
      resolve(false);
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleConfirm);

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
      else if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
    };
    document.addEventListener('keydown', handleKeyPress);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) handleCancel();
    });

    (okBtn as HTMLElement).focus();
  });
}
