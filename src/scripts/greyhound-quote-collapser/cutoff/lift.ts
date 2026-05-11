// Walk `startNode` upward, splitting its ancestors so the start sits as
// a direct child of `container`. Each ancestor between `startNode` and
// `container` is cloned (shallow), and every sibling of `startNode` that
// comes after it (including itself) is moved into the clone. The clone is
// inserted right after the original ancestor.
//
// Result: a ChildNode that is a direct child of `container` and contains
// the original `startNode` plus everything that followed it within the
// original ancestor chain.
export function liftToTopLevel(container: Element, startNode: ChildNode): ChildNode {
    let current: ChildNode = startNode
    while (current.parentNode !== null && current.parentNode !== container) {
        // Ancestors between startNode and container are always Elements
        // (Text/Comment/etc. don't have children that could nest a startNode).
        const parent = current.parentNode as Element
        const restSibling = parent.cloneNode(false) as Element
        let cursor: ChildNode | null = current
        while (cursor !== null) {
            const next: ChildNode | null = cursor.nextSibling
            restSibling.append(cursor)
            cursor = next
        }
        if (parent.parentNode !== null) {
            parent.parentNode.insertBefore(restSibling, parent.nextSibling)
        }
        current = restSibling
    }
    return current
}
