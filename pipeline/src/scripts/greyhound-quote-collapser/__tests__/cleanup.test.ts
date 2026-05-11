import { describe, expect, it } from 'vitest'
import { cleanupWhitespace } from '../body/cleanup.js'
import { CFG } from '../config.js'

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.append(div)
    return div
}

describe('cleanupWhitespace', () => {
    it('removes empty <p> elements', () => {
        const c = makeContainer('<p>keep</p><p></p><p>also keep</p><p></p>')
        cleanupWhitespace(c)
        const remaining = [...c.querySelectorAll('p')].map(p => p.textContent)
        expect(remaining).toEqual(['keep', 'also keep'])
    })

    it('removes <p> elements containing only whitespace and &nbsp;', () => {
        const c = makeContainer('<p>x</p><p>&nbsp;</p><p>   </p><p>\n</p><p>y</p>')
        cleanupWhitespace(c)
        const remaining = [...c.querySelectorAll('p')].map(p => p.textContent)
        expect(remaining).toEqual(['x', 'y'])
    })

    it('keeps <p> elements with non-whitespace text', () => {
        const c = makeContainer('<p>Hello</p><p>World</p>')
        cleanupWhitespace(c)
        expect(c.querySelectorAll('p').length).toBe(2)
    })

    it('keeps <p> elements that contain images, links, buttons or other media', () => {
        const c = makeContainer(`
            <p><img src="data:," alt=""></p>
            <p><a href="#x"></a></p>
            <p><button type="button"></button></p>
            <p><iframe></iframe></p>
            <p></p>
        `)
        cleanupWhitespace(c)
        // Four interactive/media-bearing <p> kept, one truly empty removed.
        expect(c.querySelectorAll('p').length).toBe(4)
    })

    it('never removes <p> elements carrying the wrapper or btn class', () => {
        const c = makeContainer(`
            <p class="${CFG.wrapperClass}"></p>
            <p class="${CFG.btnClass}"></p>
            <p></p>
        `)
        cleanupWhitespace(c)
        expect(c.querySelectorAll('p').length).toBe(2)
        expect(c.querySelector(`p.${CFG.wrapperClass}`)).not.toBeNull()
        expect(c.querySelector(`p.${CFG.btnClass}`)).not.toBeNull()
    })

    it('operates on the supplied root only', () => {
        const outer = makeContainer('<p></p>')
        const inner = makeContainer('<p>Inner content</p><p></p>')
        cleanupWhitespace(inner)
        expect(outer.querySelectorAll('p').length).toBe(1)
        expect(inner.querySelectorAll('p').length).toBe(1)
    })
})
