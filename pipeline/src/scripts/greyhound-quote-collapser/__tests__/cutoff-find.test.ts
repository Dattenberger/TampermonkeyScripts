import { beforeEach, describe, expect, it } from 'vitest'
import {
    findInRange,
    findQuoteCutoff,
    findFooterCutoff,
} from '../cutoff/index.js'
import { CFG } from '../config.js'

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.append(div)
    return div
}

describe('findInRange', () => {
    it('finds the first matching pattern in document order', () => {
        const c = makeContainer(`
            <p>Erster Satz</p>
            <p>Hello -----Original Message----- inline</p>
            <p>Auch ein -----Ursprüngliche Daten-----</p>
        `)
        const hit = findInRange(c, CFG.quotePatterns, null, null)
        expect(hit).not.toBeNull()
        expect(hit?.type).toBe('text')
        expect(hit?.node.nodeValue).toContain('-----Original Message-----')
    })

    it('respects startAfter — only nodes after the anchor are considered', () => {
        const c = makeContainer(`
            <p>Pre</p>
            <p>-----Ursprüngliche Daten-----</p>
            <p>Mid</p>
            <p>-----Original Message-----</p>
        `)
        const all = c.querySelectorAll('p')
        const firstQuoteTextNode = all[1]?.firstChild as Text
        const hit = findInRange(c, CFG.quotePatterns, firstQuoteTextNode, null)
        expect(hit?.node.nodeValue).toContain('-----Original Message-----')
    })

    it('respects endBefore — search stops at the anchor', () => {
        const c = makeContainer(`
            <p>Pre</p>
            <p>-----Ursprüngliche Daten-----</p>
            <p>Mid</p>
            <p>-----Original Message-----</p>
        `)
        const endNode = c.querySelectorAll('p')[3]?.firstChild as Text
        const hit = findInRange(c, CFG.quotePatterns, null, endNode)
        expect(hit?.node.nodeValue).toContain('-----Ursprüngliche Daten-----')
    })

    it('returns null when no pattern matches', () => {
        const c = makeContainer('<p>Nichts zu zitieren hier.</p>')
        expect(findInRange(c, CFG.quotePatterns, null, null)).toBeNull()
    })

    it('returns null when startAfter is not in the collected node set', () => {
        const c = makeContainer('<p>Pre</p><p>-----Ursprüngliche Daten-----</p>')
        const orphan = document.createTextNode('I do not belong')
        expect(findInRange(c, CFG.quotePatterns, orphan, null)).toBeNull()
    })

    it('skips text inside already-collapsed wrappers (re-entry guard)', () => {
        const c = makeContainer(`
            <p>Top</p>
            <div class="${CFG.wrapperClass}">
                <p>-----Ursprüngliche Daten----- inside wrapper</p>
            </div>
            <p>Visible after</p>
        `)
        const hit = findInRange(c, CFG.quotePatterns, null, null)
        expect(hit).toBeNull()
    })
})

describe('findQuoteCutoff', () => {
    it('matches "----- Ursprüngliche Daten -----"', () => {
        const c = makeContainer('<p>Body</p><p>-----Ursprüngliche Daten-----</p>')
        const hit = findQuoteCutoff(c)
        expect(hit?.type).toBe('text')
    })

    it('matches "----- Original Message -----"', () => {
        const c = makeContainer('<p>Body</p><p>-----Original Message-----</p>')
        expect(findQuoteCutoff(c)?.type).toBe('text')
    })

    it('matches "----- Forwarded message -----"', () => {
        const c = makeContainer('<p>Body</p><p>-----Forwarded message-----</p>')
        expect(findQuoteCutoff(c)?.type).toBe('text')
    })

    it('matches "Am … schrieb …:" inline-quote intro', () => {
        const c = makeContainer('<p>Body</p><p>Am 03.05.2026 um 09:12 schrieb support@example.com:</p>')
        expect(findQuoteCutoff(c)?.type).toBe('text')
    })

    it('falls back to <blockquote> when no text marker is found', () => {
        const c = makeContainer('<p>Reply</p><blockquote><p>quoted</p></blockquote>')
        const hit = findQuoteCutoff(c)
        expect(hit?.type).toBe('element')
        expect((hit as { node: Element }).node.tagName).toBe('BLOCKQUOTE')
    })

    it('returns null when neither marker nor blockquote is present', () => {
        const c = makeContainer('<p>Just a friendly note.</p>')
        expect(findQuoteCutoff(c)).toBeNull()
    })

    it('ignores blockquotes that live inside an already-collapsed wrapper', () => {
        const c = makeContainer(
            `<p>Top</p>
            <div class="${CFG.wrapperClass}"><blockquote><p>nested</p></blockquote></div>`,
        )
        expect(findQuoteCutoff(c)).toBeNull()
    })
})

describe('findFooterCutoff', () => {
    let container: HTMLElement

    beforeEach(() => {
        container = makeContainer(`
            <p>Hallo,</p>
            <p>Antwort.</p>
            <p>--</p>
            <p>Robotico.de</p>
            <p>Mährobotertechnik</p>
            <p>Datenschutz: link</p>
            <p>-----Ursprüngliche Daten-----</p>
            <p>quoted</p>
        `)
    })

    it('finds the first footer pattern before the quote cutoff', () => {
        const quote = findQuoteCutoff(container)
        const footer = findFooterCutoff(container, quote)
        expect(footer?.type).toBe('text')
        // First-hit-wins among ['--', 'Robotico.de', 'Datenschutz:', 'Mährobotertechnik']
        // in document order — '--' wins.
        expect(footer?.node.nodeValue).toContain('--')
    })

    it('returns null when no footer pattern matches', () => {
        const c = makeContainer('<p>just text</p><p>-----Ursprüngliche Daten-----</p>')
        const quote = findQuoteCutoff(c)
        expect(findFooterCutoff(c, quote)).toBeNull()
    })

    it('treats a null beforeCutoff as "no upper bound"', () => {
        const c = makeContainer('<p>Robotico.de</p><p>tail</p>')
        const footer = findFooterCutoff(c, null)
        expect(footer?.node.nodeValue).toBe('Robotico.de')
    })
})
