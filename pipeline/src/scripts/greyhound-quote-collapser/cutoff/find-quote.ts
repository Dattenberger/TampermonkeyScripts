import { CFG } from '../config.js'
import { findInRange, type Cutoff } from './find-in-range.js'

// Find the first quote cutoff in `container`.
//   1. Text-marker hit (--- Ursprüngliche Daten ---, Original Message, etc.)
//   2. Fallback: the first <blockquote> that is not itself nested inside
//      an already-collapsed wrapper.
export function findQuoteCutoff(container: Element): Cutoff | null {
    const textHit = findInRange(container, CFG.quotePatterns, null, null)
    if (textHit !== null) return textHit

    const blockquotes = container.querySelectorAll('blockquote')
    for (const bq of blockquotes) {
        let cursor: Node | null = bq.parentNode
        let inNestedWrapper = false
        while (cursor !== null && cursor !== container) {
            if (cursor instanceof Element && cursor.classList.contains(CFG.wrapperClass)) {
                inNestedWrapper = true
                break
            }
            cursor = cursor.parentNode
        }
        if (!inNestedWrapper) {
            return { type: 'element', node: bq }
        }
    }
    return null
}
