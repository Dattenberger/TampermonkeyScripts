import { processBody } from '../body/index.js'
import { injectStyles } from './styles.js'
import { setupClickDelegation } from './click-delegation.js'
import { updateIframeHeight } from './height.js'
import type { Direction } from '../types.js'

const processedDocs = new WeakSet<Document>()
const setupIframes = new WeakSet<HTMLIFrameElement>()

function safeContentDoc(iframe: HTMLIFrameElement): Document | null {
    try {
        return iframe.contentDocument
    } catch {
        // Cross-origin iframes throw — not our case (srcdoc is same-origin),
        // but the guard is cheap defence-in-depth.
        return null
    }
}

export function processIframe(iframe: HTMLIFrameElement, direction: Direction): void {
    const doc = safeContentDoc(iframe)
    if (doc === null) return
    if (processedDocs.has(doc)) return
    if (doc.body === null) return

    processedDocs.add(doc)

    injectStyles(doc)
    setupClickDelegation(iframe, doc)
    processBody(doc.body, direction)

    const view = doc.defaultView
    const raf = view?.requestAnimationFrame ?? globalThis.requestAnimationFrame
    raf(() => {
        updateIframeHeight(iframe)
    })
}

// Attach a load handler so srcdoc reloads (e.g. when Greyhound's
// "Original anzeigen" toggle swaps content) re-trigger processing.
export function setupIframe(iframe: HTMLIFrameElement, direction: Direction): void {
    if (setupIframes.has(iframe)) return
    setupIframes.add(iframe)

    const handleLoad = (): void => {
        const doc = safeContentDoc(iframe)
        if (doc !== null) processedDocs.delete(doc)
        processIframe(iframe, direction)
    }

    iframe.addEventListener('load', handleLoad)

    const doc = safeContentDoc(iframe)
    if (doc !== null && doc.readyState === 'complete' && doc.body !== null) {
        processIframe(iframe, direction)
    }
}
