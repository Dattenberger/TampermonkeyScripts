// Herkules dealer portal orders exporter: CSV buttons in the document history, in the JTL format
// of the Husqvarna exporters or as article;quantity. The discount factor is a local setting
// (@lib/settings), asked on first use and changed from the Tampermonkey menu.

import { registerFactorMenu } from '@lib/settings'
import { attachButtons, DISCOUNT_FACTOR } from './export.js'

registerFactorMenu(DISCOUNT_FACTOR, 'Skonto-Faktor ändern')

if (/action=webshop_document_history/.test(globalThis.location.search)) {
    attachButtons()
    new MutationObserver(() => attachButtons()).observe(document.body, { childList: true, subtree: true })
}
