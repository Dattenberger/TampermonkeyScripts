// iframe-srcdoc layout — Greyhound's Detail/Vollansicht mounts the mail
// body into an <iframe srcdoc>. We delegate to the existing iframe pipeline
// and additionally observe the item for late-mounted iframes (React swaps
// them in when the user expands compact → full view).

import { CFG } from '../config.js'
import { setupIframe } from '../iframe/setup.js'
import type { LayoutHandler } from './types.js'
import type { Direction } from '../types.js'

const wiredItems = new WeakSet<Element>()

function setupAllIframes(itemEl: Element, direction: Direction): void {
    for (const iframe of itemEl.querySelectorAll<HTMLIFrameElement>(CFG.iframeSelector)) {
        setupIframe(iframe, direction)
    }
}

export const iframeLayout: LayoutHandler = {
    name: 'iframe-srcdoc',
    matches: (itemEl) => itemEl.querySelector(CFG.iframeSelector) !== null,
    setup: (itemEl, direction) => {
        if (wiredItems.has(itemEl)) return
        wiredItems.add(itemEl)

        setupAllIframes(itemEl, direction)
        // Catch the compact→full view swap: setupIframe is idempotent via
        // its own WeakSet, so re-running on every mutation is cheap.
        const observer = new MutationObserver(() => {
            setupAllIframes(itemEl, direction)
        })
        observer.observe(itemEl, { childList: true, subtree: true })
    },
}
