import { describe, expect, it } from 'vitest'
import { applyCutoff } from '../cutoff/apply.js'
import type { Cutoff } from '../cutoff/find-in-range.js'
import { CFG } from '../config.js'

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.append(div)
    return div
}

describe('applyCutoff (text cutoff)', () => {
    it('does not split the text node when index === 0', () => {
        const c = makeContainer('<p>before</p><p>-----Ursprüngliche Daten-----</p><p>after</p>')
        const markerText = c.querySelectorAll('p')[1]?.firstChild as Text
        const cutoff: Cutoff = { type: 'text', node: markerText, index: 0 }

        const r = applyCutoff(c, cutoff, 'Älteren Verlauf')

        expect(r.btn.classList.contains(CFG.btnClass)).toBe(true)
        expect(r.wrapper.classList.contains(CFG.wrapperClass)).toBe(true)
        // 'before' stays outside, marker+after end up inside the wrapper.
        const outsideText = [...c.children]
            .filter(el => el !== r.btn && el !== r.wrapper)
            .map(el => el.textContent ?? '')
            .join(' | ')
        expect(outsideText).toContain('before')
        expect(outsideText).not.toContain('-----Ursprüngliche Daten-----')
        expect(r.wrapper.textContent).toContain('-----Ursprüngliche Daten-----')
        expect(r.wrapper.textContent).toContain('after')
    })

    it('splits the text node when index > 0 and keeps the prefix outside', () => {
        const c = makeContainer('<p>visible text -----Ursprüngliche Daten----- tail</p>')
        const node = c.querySelector('p')?.firstChild as Text
        const idx = node.nodeValue?.indexOf('-----Ursprüngliche Daten-----') ?? -1
        expect(idx).toBeGreaterThan(0)

        const r = applyCutoff(c, { type: 'text', node, index: idx }, 'Älteren Verlauf')

        // The original text node was split — the prefix stays in the outer p,
        // the marker (and everything after) lives in the wrapper.
        const outsideText = [...c.children]
            .filter(el => el !== r.btn && el !== r.wrapper)
            .map(el => el.textContent ?? '')
            .join(' | ')
        expect(outsideText).toContain('visible text')
        expect(outsideText).not.toContain('-----Ursprüngliche Daten-----')
        expect(r.wrapper.textContent).toContain('-----Ursprüngliche Daten-----')
        expect(r.wrapper.textContent).toContain('tail')
    })

    it('applies the requested label and type class', () => {
        const c = makeContainer('<p>before</p><blockquote><p>quote</p></blockquote>')
        const bq = c.querySelector('blockquote')
        if (bq === null) throw new Error('test setup')
        const cutoff: Cutoff = { type: 'element', node: bq }

        const r = applyCutoff(c, cutoff, 'Signatur & Verlauf', null, CFG.btnDetectedSigClass)

        expect(r.btn.dataset.label).toBe('Signatur & Verlauf')
        expect(r.btn.textContent).toBe('↓ Signatur & Verlauf anzeigen')
        expect(r.btn.classList.contains(CFG.btnDetectedSigClass)).toBe(true)
    })

    it('honours endNode — siblings beyond endNode stay outside the wrapper', () => {
        const c = makeContainer('<p>before</p><p>quote start</p><p>middle</p><p>END_MARKER</p><p>after end</p>')
        const ps = c.querySelectorAll('p')
        const startText = ps[1]?.firstChild as Text
        const endNode = ps[3]
        if (!startText || !endNode) throw new Error('test setup')

        const r = applyCutoff(c, { type: 'text', node: startText, index: 0 }, 'X', endNode)

        expect(r.wrapper.textContent).toContain('quote start')
        expect(r.wrapper.textContent).toContain('middle')
        expect(r.wrapper.textContent).not.toContain('END_MARKER')
        expect(r.wrapper.textContent).not.toContain('after end')
        // END_MARKER and after end remain as siblings of the wrapper.
        const tail = [...c.children].slice(-2).map(el => el.textContent ?? '')
        expect(tail.join(' ')).toContain('END_MARKER')
        expect(tail.join(' ')).toContain('after end')
    })
})

describe('applyCutoff (element cutoff)', () => {
    it('wraps from the element onwards without splitting', () => {
        const c = makeContainer('<p>Reply</p><blockquote><p>q1</p></blockquote><p>tail</p>')
        const bq = c.querySelector('blockquote')
        if (bq === null) throw new Error('test setup')
        const cutoff: Cutoff = { type: 'element', node: bq }

        const r = applyCutoff(c, cutoff, 'Älteren Verlauf')

        expect(r.wrapper.querySelector('blockquote')).not.toBeNull()
        expect(r.wrapper.textContent).toContain('tail')
        // The original <p>Reply</p> stays outside.
        const outsideText = [...c.children]
            .filter(el => el !== r.btn && el !== r.wrapper)
            .map(el => el.textContent ?? '')
            .join(' | ')
        expect(outsideText).toContain('Reply')
    })
})
