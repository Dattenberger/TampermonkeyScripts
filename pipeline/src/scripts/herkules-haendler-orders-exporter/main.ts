// Herkules dealer portal orders exporter: in the document history, one CSV button per order in the
// JTL format of the Husqvarna exporters. Beside it a field for our D-BE number, since the portal has
// none: filled from the order's references where they hold one, else typed and kept locally. A panel
// on the right holds the discount factor as a local setting (@lib/settings).

import { attachExport } from './export.js'

if (/action=webshop_document_history/.test(globalThis.location.search)) {
    attachExport()
    new MutationObserver(() => attachExport()).observe(document.body, { childList: true, subtree: true })
}
