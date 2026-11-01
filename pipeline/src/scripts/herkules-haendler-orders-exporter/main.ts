// Herkules dealer portal orders exporter: in the document history, one CSV button per order in the
// JTL format of the Husqvarna exporters, our reference shown beside it, and a panel on the right
// with the discount factor as a local setting (@lib/settings).

import { attachExport } from './export.js'

if (/action=webshop_document_history/.test(globalThis.location.search)) {
    attachExport()
    new MutationObserver(() => attachExport()).observe(document.body, { childList: true, subtree: true })
}
