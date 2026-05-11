import { CFG } from '../config.js'
import {
    findInRange,
    findQuoteCutoff,
    findFooterCutoff,
    applyCutoff,
    applyCutoffWithLiftedEnd,
    type Cutoff,
    type TextCutoff,
} from '../cutoff/index.js'
import { cleanupWhitespace } from './cleanup.js'
import type { Direction } from '../types.js'

// Iteratively detect and wrap signature blocks within an already-collapsed
// thread. `skipUntilFirstQuote` controls whether the first signature (the
// sender's own) should be skipped — that's already wrapped by the outer
// cutoff and would lead to a double-collapse otherwise.
function detectSigsInThread(threadWrapper: Element, skipUntilFirstQuote: boolean): void {
    let searchAfterNode: Text | null = null

    if (skipUntilFirstQuote) {
        const firstQuote = findInRange(threadWrapper, CFG.quotePatterns, null, null)
        if (firstQuote === null) return
        searchAfterNode = firstQuote.node
    }

    for (let i = 0; i < CFG.threadSigMaxIterations; i++) {
        const sig: TextCutoff | null = findInRange(threadWrapper, CFG.footerPatterns, searchAfterNode, null)
        if (sig === null) break
        const nextQuote: TextCutoff | null = findInRange(threadWrapper, CFG.quotePatterns, sig.node, null)
        applyCutoffWithLiftedEnd(threadWrapper, sig, nextQuote, 'Signatur', CFG.btnDetectedSigClass)
        if (nextQuote === null) break
        searchAfterNode = nextQuote.node
    }
}

export function processBody(body: HTMLElement, direction: Direction): void {
    const quote = findQuoteCutoff(body)

    let outerCutoff: Cutoff | null = null
    let outerLabel = 'Älteren Verlauf'
    let cutoffIsFooter = false

    if (direction === 'outgoing') {
        const footer = findFooterCutoff(body, quote)
        if (footer !== null) {
            outerCutoff = footer
            cutoffIsFooter = true
            outerLabel = 'Signatur & Verlauf'
        }
    }
    if (outerCutoff === null) outerCutoff = quote

    if (outerCutoff !== null) {
        const result = applyCutoff(body, outerCutoff, outerLabel, null, CFG.btnQuoteClass)
        detectSigsInThread(result.wrapper, cutoffIsFooter)
    }

    cleanupWhitespace(body)
}
