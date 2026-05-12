import { CFG } from '../config.js'
import { makeToggleBtn } from '../dom/index.js'
import { liftToTopLevel } from './lift.js'
import type { Cutoff, TextCutoff } from './find-in-range.js'

export interface ApplyCutoffResult {
    btn: HTMLButtonElement
    wrapper: HTMLDivElement
}

export interface ApplyCutoffWithLiftedEndResult extends ApplyCutoffResult {
    // The text node that NOW starts with the end marker, after any
    // splitText() the wrapping had to perform. Callers iterating through
    // a thread must use THIS node — not `endCutoff.node` — as the next
    // `startAfter` anchor, because splitText leaves the original node
    // holding only the whitespace prefix, which `collectTextNodes` then
    // filters out (no `indexOf` hit → search returns null).
    endStart: Text | null
}

// Apply a cutoff: split (if text), lift to top level, insert toggle button
// + collapsed wrapper, move siblings from cutoff up to `endNode` (exclusive)
// into the wrapper.
export function applyCutoff(
    container: Element,
    cutoff: Cutoff,
    label: string,
    endNode: Node | null = null,
    typeClass: string = CFG.btnQuoteClass,
): ApplyCutoffResult {
    const doc = container.ownerDocument
    const startNode: ChildNode =
        cutoff.type === 'text'
            ? cutoff.index === 0
                ? cutoff.node
                : cutoff.node.splitText(cutoff.index)
            : cutoff.node

    const topNode = liftToTopLevel(container, startNode)
    const wrapper = doc.createElement('div')
    wrapper.className = CFG.wrapperClass
    const btn = makeToggleBtn(doc, label, typeClass)
    topNode.before(btn)
    topNode.before(wrapper)

    let cursor: ChildNode | null = topNode
    while (cursor !== null && cursor !== endNode) {
        const next: ChildNode | null = cursor.nextSibling
        wrapper.append(cursor)
        cursor = next
    }
    return { btn, wrapper }
}

// Same as `applyCutoff`, but the `endCutoff` is lifted to top level first
// so we can stop wrapping at the lifted boundary. Used by detect-sigs to
// wrap one signature without sucking up the next quote-block too.
export function applyCutoffWithLiftedEnd(
    container: Element,
    sigCutoff: TextCutoff,
    endCutoff: TextCutoff | null,
    label: string,
    typeClass: string,
): ApplyCutoffWithLiftedEndResult {
    let endTopNode: ChildNode | null = null
    let endStart: Text | null = null
    if (endCutoff !== null) {
        endStart = endCutoff.index === 0 ? endCutoff.node : endCutoff.node.splitText(endCutoff.index)
        endTopNode = liftToTopLevel(container, endStart)
    }
    return { ...applyCutoff(container, sigCutoff, label, endTopNode, typeClass), endStart }
}
