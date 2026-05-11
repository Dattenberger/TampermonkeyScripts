import { CFG } from '../config.js'

// Collect every text node under `container` that is:
//   - not inside an already-collapsed wrapper (so re-entry doesn't loop),
//   - not inside one of our toggle buttons,
//   - non-blank after trim.
//
// Order is document order (TreeWalker default).
export function collectTextNodes(container: Element): Text[] {
    const doc = container.ownerDocument
    const nodes: Text[] = []
    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Node): number {
            const text = node as Text
            let parent: Node | null = text.parentNode
            while (parent !== null && parent !== container) {
                if (parent instanceof Element && parent.classList.contains(CFG.wrapperClass)) {
                    return NodeFilter.FILTER_REJECT
                }
                parent = parent.parentNode
            }
            const parentEl = text.parentElement
            if (parentEl?.closest(`.${CFG.btnClass}`) != null) {
                return NodeFilter.FILTER_REJECT
            }
            const value = text.nodeValue ?? ''
            if (value.trim().length === 0) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        },
    })

    let current = walker.nextNode()
    while (current !== null) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }
    return nodes
}
