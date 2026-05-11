// Per-item dispatcher: walks the layout registry, hands off to the first
// matching handler. Each handler owns its own idempotency and lifecycle
// (see layouts/*.ts).

import { CFG } from './config.js'
import { layouts } from './layouts/index.js'
import type { Direction } from './types.js'

const dispatchedItems = new WeakSet<Element>()

function getDirection(itemEl: Element): Direction {
    return itemEl.closest(CFG.outgoingSelector) === null ? 'incoming' : 'outgoing'
}

export function setupItem(itemEl: Element): void {
    if (itemEl.classList.contains(CFG.legacyCloneClass)) return
    if (dispatchedItems.has(itemEl)) return
    dispatchedItems.add(itemEl)

    const direction = getDirection(itemEl)
    for (const layout of layouts) {
        if (layout.matches(itemEl)) {
            layout.setup(itemEl, direction)
            return
        }
    }
}
