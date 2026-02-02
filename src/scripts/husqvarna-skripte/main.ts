import { debounce } from '@lib/utils';
import { applyStyles } from './styles';
import { Config } from './config';
import { isOrderListPage } from './dom/extract';
import { attachExportButtonToNewLayout, attachExportButtonToOldModal, attachExportButtonsToOrderList } from './ui/export-buttons';
import { setupCustomOrderInputObserver } from './ui/custom-order-input';
import { createModeToggle } from './ui/mode-toggle';
import { createDownloadAllBar } from './ui/download-all-bar';


applyStyles();

function initializeScript(): void {
  setupCustomOrderInputObserver();

  const handleDOMChanges = debounce(() => {
    if (document.querySelector('[data-testid="order-detail-page"]')) attachExportButtonToNewLayout();
    if (document.querySelector('div#ui-modal-target article header')) attachExportButtonToOldModal();
    if (isOrderListPage()) {
      const orderListPage = document.querySelector('[data-testid="order-list-page"]');
      if (orderListPage) {
        createModeToggle(orderListPage);
        createDownloadAllBar(orderListPage);
      }
      attachExportButtonsToOrderList();
    }
  }, Config.timing.DEBOUNCE_DELAY);

  handleDOMChanges();

  const mutationObserver = new MutationObserver(mutations => {
    if (!location.pathname.includes('/de/orders')) return;
    if (mutations.some(m => m.type === 'childList')) handleDOMChanges();
  });
  mutationObserver.observe(document.body, { subtree: true, childList: true });
}

jQuery(document).ready(initializeScript);
