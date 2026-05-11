import { CFG } from '../config.js'

const INTERACTIVE_OR_MEDIA_SELECTOR = 'img, svg, video, audio, button, input, iframe, a'
// `\s` already matches U+00A0 (NBSP) in modern JS regex engines, but the
// explicit class survives any future engine-spec drift and signals intent.
// We escape the NBSP rather than inline it so `no-irregular-whitespace`
// stays clean.
const WHITESPACE_INCLUDING_NBSP = /[\u00A0\s]/g

// A <p> is visually empty when, after stripping whitespace (including
// non-breaking spaces), it has no text AND no interactive / media child.
// Wrapper- and toggle-classed elements are never empty by definition.
function isVisuallyEmpty(el: Element): boolean {
    if (el.classList.contains(CFG.wrapperClass)) return false
    if (el.classList.contains(CFG.btnClass)) return false
    if (el.querySelector(INTERACTIVE_OR_MEDIA_SELECTOR) !== null) return false
    const text = (el.textContent ?? '').replaceAll(WHITESPACE_INCLUDING_NBSP, '')
    return text.length === 0
}

export function cleanupWhitespace(root: Element): void {
    const toRemove: Element[] = []
    for (const el of root.querySelectorAll('p')) {
        if (isVisuallyEmpty(el)) toRemove.push(el)
    }
    for (const el of toRemove) el.remove()
}
