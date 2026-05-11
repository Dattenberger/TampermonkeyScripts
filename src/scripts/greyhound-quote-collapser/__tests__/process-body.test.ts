import { describe, expect, it } from 'vitest'
import { processBody } from '../body/index.js'
import { CFG } from '../config.js'
import {
    OUTGOING_MULTI_QUOTE,
    INCOMING_URSPRUNGLICHE_DATEN,
    INCOMING_BLOCKQUOTE_ONLY,
    OUTGOING_NO_FOOTER,
} from './fixtures.js'

function makeBody(html: string): HTMLElement {
    const body = document.createElement('div')
    body.innerHTML = html
    document.body.append(body)
    return body
}

describe('processBody', () => {
    it('incoming: produces a single quote wrapper labelled "Älteren Verlauf"', () => {
        const body = makeBody(INCOMING_URSPRUNGLICHE_DATEN)
        processBody(body, 'incoming')

        const buttons = body.querySelectorAll(`.${CFG.btnClass}`)
        expect(buttons.length).toBeGreaterThanOrEqual(1)
        const outerBtn = buttons[0]
        expect(outerBtn?.classList.contains(CFG.btnQuoteClass)).toBe(true)
        expect(outerBtn?.textContent).toContain('Älteren Verlauf')
    })

    it('incoming + blockquote-only: wraps the blockquote', () => {
        const body = makeBody(INCOMING_BLOCKQUOTE_ONLY)
        processBody(body, 'incoming')

        const wrapper = body.querySelector(`.${CFG.wrapperClass}`)
        expect(wrapper).not.toBeNull()
        expect(wrapper?.querySelector('blockquote')).not.toBeNull()
    })

    it('outgoing with footer + quote: outer wrapper is labelled "Signatur & Verlauf"', () => {
        const body = makeBody(OUTGOING_MULTI_QUOTE)
        processBody(body, 'outgoing')

        const outerBtn = body.querySelector(`.${CFG.btnQuoteClass}`)
        expect(outerBtn).not.toBeNull()
        expect(outerBtn?.textContent).toContain('Signatur & Verlauf')
    })

    it('outgoing without footer: falls back to "Älteren Verlauf"', () => {
        const body = makeBody(OUTGOING_NO_FOOTER)
        processBody(body, 'outgoing')

        const outerBtn = body.querySelector(`.${CFG.btnQuoteClass}`)
        expect(outerBtn).not.toBeNull()
        expect(outerBtn?.textContent).toContain('Älteren Verlauf')
    })

    it('outgoing-multi-quote real fixture: produces nested signature wrappers in the thread', () => {
        const body = makeBody(OUTGOING_MULTI_QUOTE)
        processBody(body, 'outgoing')

        const innerSigButtons = body.querySelectorAll(`.${CFG.btnDetectedSigClass}`)
        // Nested thread has at least one additional signature block.
        expect(innerSigButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('plain body with no markers and no blockquote: no wrapper is created', () => {
        const body = makeBody('<p>just a note</p><p>no quotes here</p>')
        processBody(body, 'incoming')

        expect(body.querySelector(`.${CFG.wrapperClass}`)).toBeNull()
        expect(body.querySelector(`.${CFG.btnClass}`)).toBeNull()
    })
})
