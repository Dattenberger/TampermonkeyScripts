import { CFG } from '../config.js'
import { findInRange, type Cutoff, type TextCutoff } from './find-in-range.js'

// Find the first footer (signature) cutoff in `container` strictly before
// `beforeCutoff` (typically the outer quote cutoff). Footer markers must
// be text — there is no element fallback.
export function findFooterCutoff(container: Element, beforeCutoff: Cutoff | null): TextCutoff | null {
    const endBefore = beforeCutoff !== null && beforeCutoff.type === 'text' ? beforeCutoff.node : null
    return findInRange(container, CFG.footerPatterns, null, endBefore)
}
