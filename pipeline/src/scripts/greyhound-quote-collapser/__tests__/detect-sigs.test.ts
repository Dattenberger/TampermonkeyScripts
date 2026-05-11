import { describe, expect, it } from 'vitest'
import { processBody } from '../body/index.js'
import { CFG } from '../config.js'

function makeBody(html: string): HTMLElement {
    const body = document.createElement('div')
    body.innerHTML = html
    document.body.append(body)
    return body
}

// detectSigsInThread is exercised via the public `processBody` entry on
// outgoing emails — that's the only path that activates it. We don't unit-
// test the private helper directly so we don't lock the implementation.

describe('detectSigsInThread (via processBody outgoing)', () => {
    it('wraps multiple signature blocks inside the collapsed thread', () => {
        const body = makeBody(`
            <p>Hallo Kunde,</p>
            <p>kurze Antwort.</p>
            <p>--</p>
            <p>Mein Name
- Geschäftsleitung -</p>
            <p>Robotico.de</p>
            <p>Datenschutz: link</p>
            <p>-----Ursprüngliche Daten-----</p>
            <p>Anfrage des Kunden.</p>
            <p>--</p>
            <p>Kundenname
GMX Mail App</p>
            <p>-----Ursprüngliche Daten-----</p>
            <p>Tieferer Verlauf.</p>
            <p>Mährobotertechnik</p>
            <p>Datenschutz: link2</p>
        `)
        processBody(body, 'outgoing')

        const collapsedWrappers = body.querySelectorAll(`.${CFG.wrapperClass}`)
        // 1 outer "Signatur & Verlauf" + ≥1 inner detected-sig wrappers
        expect(collapsedWrappers.length).toBeGreaterThanOrEqual(2)

        const innerSigButtons = body.querySelectorAll(`.${CFG.btnDetectedSigClass}`)
        expect(innerSigButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('skips the first signature when it sits before the first quote in the thread', () => {
        // The outer cutoff wraps the *whole* signature+thread block. The inner
        // detection then has skipUntilFirstQuote=true and must NOT re-wrap the
        // already-wrapped outer signature.
        const body = makeBody(`
            <p>Body</p>
            <p>--</p>
            <p>Outer signature line</p>
            <p>-----Ursprüngliche Daten-----</p>
            <p>quoted body</p>
        `)
        processBody(body, 'outgoing')

        // The outer wrapper exists and contains the outer signature; no
        // ADDITIONAL detected-sig wrapper should sit inside it for the
        // outer signature itself.
        const outerWrapper = body.querySelector(`.${CFG.wrapperClass}`)
        expect(outerWrapper).not.toBeNull()
        // There is no nested quote after the outer signature, so no detected-
        // sig wrapper should be created at all in this minimal case.
        const innerSigButtons = body.querySelectorAll(`.${CFG.btnDetectedSigClass}`)
        expect(innerSigButtons.length).toBe(0)
    })

    it('stops cleanly when no further signatures or quotes are found', () => {
        const body = makeBody(`
            <p>Body</p>
            <p>--</p>
            <p>One-and-only signature</p>
        `)
        // Should not throw or hang.
        expect(() => {
            processBody(body, 'outgoing')
        }).not.toThrow()
    })

    it('respects threadSigMaxIterations as an upper bound', () => {
        // Build a pathologically long alternating thread that would normally
        // exceed any sane iteration count. The hard limit must engage.
        const parts: string[] = ['<p>Body</p>', '<p>--</p>', '<p>Sig 0</p>']
        for (let i = 1; i < CFG.threadSigMaxIterations + 3; i++) {
            parts.push('<p>-----Ursprüngliche Daten-----</p>', `<p>Quote ${String(i)}</p>`, `<p>Robotico.de</p>`)
        }
        const body = makeBody(parts.join('\n'))

        expect(() => {
            processBody(body, 'outgoing')
        }).not.toThrow()

        // The outer wrapper plus ≤ threadSigMaxIterations inner wrappers.
        const innerSigCount = body.querySelectorAll(`.${CFG.btnDetectedSigClass}`).length
        expect(innerSigCount).toBeLessThanOrEqual(CFG.threadSigMaxIterations)
    })
})
