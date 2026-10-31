// Herkules dealer portal orders exporter: CSV buttons in the document history, in the JTL format
// of the Husqvarna exporters or as article;quantity. The discount factor is a local setting
// (@lib/settings): shown beside every CSV button and changed there with one click, asked on first
// use, and changeable from the Tampermonkey menu as well.

import { registerFactorMenu } from '@lib/settings'
import { attachButtons, DISCOUNT_FACTOR } from './export.js'

registerFactorMenu(DISCOUNT_FACTOR, 'Skonto-Faktor ändern')

if (/action=webshop_document_history/.test(globalThis.location.search)) {
    attachButtons()
    new MutationObserver(() => attachButtons()).observe(document.body, { childList: true, subtree: true })
}
