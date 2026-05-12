import { CFG } from '../config.js'

const INTERACTIVE_OR_MEDIA_SELECTOR = 'img, svg, video, audio, button, input, iframe, a'
// `\s` already matches U+00A0 (NBSP) in modern JS regex engines, but the
// explicit class survives any future engine-spec drift and signals intent.
// The escape sequence is used rather than the literal character so the
// `no-irregular-whitespace` lint rule stays clean.
const WHITESPACE_INCLUDING_NBSP = /[\u00A0\s]/g

// A <p> is visually empty when, after stripping whitespace (including
// non-breaking spaces), it has no text AND no interactive / media child.
// Wrapper- and toggle-classed elements are never empty by definition.
function isVisuallyEmptyP(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false
    const el = node as Element
    if (el.tagName !== 'P') return false
    if (el.classList.contains(CFG.wrapperClass)) return false
    if (el.classList.contains(CFG.btnClass)) return false
    if (el.querySelector(INTERACTIVE_OR_MEDIA_SELECTOR) !== null) return false
    const text = (el.textContent ?? '').replaceAll(WHITESPACE_INCLUDING_NBSP, '')
    return text.length === 0
}

function isWhitespaceTextNode(node: Node): boolean {
    if (node.nodeType !== Node.TEXT_NODE) return false
    return (node.nodeValue ?? '').replaceAll(WHITESPACE_INCLUDING_NBSP, '').length === 0
}

// True when every sibling between `p` and the start of its parent is either
// pure-whitespace text or another empty <p>. I.e. `p` belongs to a run of
// empties touching the leading edge.
function precedingIsAllEmpty(p: Element): boolean {
    let n: Node | null = p.previousSibling
    while (n !== null) {
        if (!isWhitespaceTextNode(n) && !isVisuallyEmptyP(n)) return false
        n = n.previousSibling
    }
    return true
}

function followingIsAllEmpty(p: Element): boolean {
    let n: Node | null = p.nextSibling
    while (n !== null) {
        if (!isWhitespaceTextNode(n) && !isVisuallyEmptyP(n)) return false
        n = n.nextSibling
    }
    return true
}

// True when the previous meaningful sibling (skipping pure-whitespace text)
// is another empty <p>. Drives the "collapse consecutive empties to one"
// rule: keep the first empty in a run, drop the rest.
function previousIsEmptyP(p: Element): boolean {
    let n: Node | null = p.previousSibling
    while (n !== null && isWhitespaceTextNode(n)) n = n.previousSibling
    return n !== null && isVisuallyEmptyP(n)
}

// Remove empty <p> elements only when they violate one of three rules:
//
//   1. Leading      — every preceding sibling is whitespace text or another
//                     empty <p>. The mail must not start with blank space.
//   2. Trailing     — every following sibling is whitespace text or another
//                     empty <p>. The mail must not end with blank space.
//   3. Run collapse — the directly-preceding meaningful sibling is itself
//                     an empty <p>. At most one empty <p> may sit between
//                     two content elements.
//
// A single empty <p> between two pieces of real content is preserved:
// Greyhound's stylesheet strips default <p>-margins, so these empties are
// the body's only inter-paragraph spacing.
export function cleanupWhitespace(root: Element): void {
    const candidates: Element[] = []
    for (const p of root.querySelectorAll('p')) {
        if (isVisuallyEmptyP(p)) candidates.push(p)
    }
    const toRemove: Element[] = []
    for (const p of candidates) {
        if (precedingIsAllEmpty(p)) {
            toRemove.push(p)
            continue
        }
        if (followingIsAllEmpty(p)) {
            toRemove.push(p)
            continue
        }
        if (previousIsEmptyP(p)) {
            toRemove.push(p)
        }
    }
    for (const el of toRemove) el.remove()
}
