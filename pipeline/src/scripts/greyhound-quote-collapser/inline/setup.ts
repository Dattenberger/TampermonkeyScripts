// Inline (non-iframe) layout setup.
//
// Greyhound's ChatView renders mail bodies directly into the page DOM —
// no `<iframe srcdoc>` wrapper. Two consequences vs. the iframe path:
//
//   1. React owns the subtree we are mutating. It may re-render it at any
//      time (selection change, "Original anzeigen" toggle, animation), which
//      would wipe our toggle buttons and wrapper divs. We compensate with a
//      MutationObserver that re-applies processBody whenever our markers
//      disappear ("self-healing").
//
//   2. Styles can be injected once into the page document; our buttons then
//      inherit Greyhound's font/colour context. This is a CSS-vererbung
//      bonus the iframe path can't have.
//
// Reentrancy: ensureProcessed mutates the subtree — without precautions, the
// observer would fire on our own mutations and recurse. We disconnect the
// observer for the duration of the mutation and reconnect afterwards. A
// processing flag guards against re-entry through layered async paths.

import { CFG } from '../config.js'
import { processBody } from '../body/index.js'
import { injectStyles } from '../iframe/styles.js'
import { setupInlineClickDelegation } from './click-delegation.js'
import type { Direction } from '../types.js'

const setupItems = new WeakSet<Element>()

// Removes our wrappers without losing the content they contain. Buttons are
// pure UI and just get removed; wrappers are unwrapped (children spliced
// back into the parent in place). querySelectorAll returns a static
// snapshot, so iterating forward is safe even as the tree changes.
function unwrapAndRemoveStale(itemEl: Element): void {
    for (const btn of itemEl.querySelectorAll(`.${CFG.btnClass}`)) {
        btn.remove()
    }
    for (const wrapper of itemEl.querySelectorAll(`.${CFG.wrapperClass}`)) {
        const parent = wrapper.parentNode
        if (parent === null) continue
        while (wrapper.firstChild !== null) {
            parent.insertBefore(wrapper.firstChild, wrapper)
        }
        wrapper.remove()
    }
}

function ensureProcessed(itemEl: HTMLElement, direction: Direction): void {
    // Marker present → already done. Cheap pre-flight to avoid re-wrapping
    // on every observer fire when React touched something unrelated.
    if (itemEl.querySelector(`.${CFG.btnClass}`) !== null) return
    unwrapAndRemoveStale(itemEl)
    processBody(itemEl, direction)
}

export function setupInline(itemEl: HTMLElement, direction: Direction): void {
    if (setupItems.has(itemEl)) return
    setupItems.add(itemEl)

    const doc = itemEl.ownerDocument
    injectStyles(doc)
    setupInlineClickDelegation(doc)

    let processing = false
    const observer = new MutationObserver(() => {
        if (processing) return
        processing = true
        observer.disconnect()
        try {
            ensureProcessed(itemEl, direction)
        } finally {
            observer.observe(itemEl, { childList: true, subtree: true })
            processing = false
        }
    })

    // Initial pass before wiring the observer — same disconnect/reconnect
    // discipline applies because processBody itself triggers mutations.
    processing = true
    try {
        ensureProcessed(itemEl, direction)
    } finally {
        observer.observe(itemEl, { childList: true, subtree: true })
        processing = false
    }
}
