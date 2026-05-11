import { collectTextNodes } from '../dom/index.js'

// A cutoff describes WHERE in the DOM the collapse boundary sits.
//   - 'text': inside a text node at a specific character index.
//   - 'element': at the start of a specific element (used for blockquote
//     fallback, which has no associated text-marker).
export interface TextCutoff {
    type: 'text'
    node: Text
    index: number
}

export interface ElementCutoff {
    type: 'element'
    node: Element
}

export type Cutoff = TextCutoff | ElementCutoff

// Walk the visible text nodes of `container` and return the first one
// (in document order) that matches any of the supplied patterns.
//
// `startAfter` / `endBefore` narrow the search range to the slice
// *after* the start-anchor and *before* the end-anchor. Anchors are
// matched by node identity; if an anchor isn't among the collected
// text nodes the function returns null (start) or treats the absence
// as "no end limit" (end).
export function findInRange(
    container: Element,
    patterns: readonly RegExp[],
    startAfter: Text | null,
    endBefore: Text | null,
): TextCutoff | null {
    const nodes = collectTextNodes(container)
    let startIdx = 0
    if (startAfter !== null) {
        const idx = nodes.indexOf(startAfter)
        if (idx === -1) return null
        startIdx = idx + 1
    }
    let endIdx = nodes.length
    if (endBefore !== null) {
        const idx = nodes.indexOf(endBefore)
        if (idx !== -1) endIdx = idx
    }
    for (let i = startIdx; i < endIdx; i++) {
        const node = nodes[i]
        if (!node) continue
        const text = node.nodeValue ?? ''
        let bestIndex = -1
        for (const pattern of patterns) {
            const m = pattern.exec(text)
            if (m && (bestIndex < 0 || m.index < bestIndex)) {
                bestIndex = m.index
            }
        }
        if (bestIndex >= 0) {
            return { type: 'text', node, index: bestIndex }
        }
    }
    return null
}
