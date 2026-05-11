import { IFRAME_CSS, STYLE_MARKER_ATTR } from '../config.js'

// Inject our stylesheet into the iframe's document. Idempotent — the
// data-marker attribute guards against double injection across re-runs.
export function injectStyles(doc: Document): void {
    if (doc.querySelector(`style[${STYLE_MARKER_ATTR}]`) !== null) return
    const style = doc.createElement('style')
    style.setAttribute(STYLE_MARKER_ATTR, '1')
    style.textContent = IFRAME_CSS
    ;(doc.head ?? doc.documentElement).append(style)
}
