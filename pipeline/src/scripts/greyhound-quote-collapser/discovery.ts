import { debounce } from '@lib/utils'
import { CFG } from './config.js'
import { setupItem } from './item-setup.js'

function scanForItems(): void {
    for (const itemEl of document.querySelectorAll(CFG.itemSelector)) {
        if (itemEl.classList.contains(CFG.legacyCloneClass)) continue
        setupItem(itemEl)
    }
}

const triggerScan = debounce(scanForItems, CFG.debounceMs)

const discoveryObserver = new MutationObserver((mutations: MutationRecord[]) => {
    let needsScan = false
    for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
            if (added.nodeType !== Node.ELEMENT_NODE) continue
            const el = added as Element
            if (el.matches(CFG.itemSelector) || el.querySelector(CFG.itemSelector) !== null) {
                needsScan = true
            }
        }
    }
    if (needsScan) triggerScan()
})

export function startDiscovery(): void {
    discoveryObserver.observe(document.body, { childList: true, subtree: true })
    scanForItems()
}
