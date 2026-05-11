import { CFG } from './config.js'
import { setupIframe } from './iframe/index.js'
import type { Direction } from './types.js'

const processedItems = new WeakSet<Element>()

function getDirection(itemEl: Element): Direction {
    return itemEl.closest(CFG.outgoingSelector) === null ? 'incoming' : 'outgoing'
}

export function setupItem(itemEl: Element): void {
    if (processedItems.has(itemEl)) return
    if (itemEl.classList.contains(CFG.legacyCloneClass)) return
    processedItems.add(itemEl)

    const direction = getDirection(itemEl)

    const setupAllIframes = (): void => {
        for (const iframe of itemEl.querySelectorAll<HTMLIFrameElement>(CFG.iframeSelector)) {
            setupIframe(iframe, direction)
        }
    }

    setupAllIframes()

    // React may swap iframes later (e.g. when expanding from compact to
    // full view) — keep watching this item for newly-mounted iframes.
    const observer = new MutationObserver(setupAllIframes)
    observer.observe(itemEl, { childList: true, subtree: true })
}
