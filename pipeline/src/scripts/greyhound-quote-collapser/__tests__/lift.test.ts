import { describe, expect, it } from 'vitest'
import { liftToTopLevel } from '../cutoff/lift.js'

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.append(div)
    return div
}

describe('liftToTopLevel', () => {
    it('returns the node itself when it already sits at top level', () => {
        const c = makeContainer('<p>alpha</p><p>beta</p>')
        const beta = c.querySelectorAll('p')[1]
        if (!beta) throw new Error('test setup')

        const result = liftToTopLevel(c, beta)
        expect(result).toBe(beta)
        expect(result.parentNode).toBe(c)
    })

    it('lifts a deeply nested node up to a direct child of the container', () => {
        const c = makeContainer('<section><article><p><span id="needle">x</span></p></article></section>')
        const needle = c.querySelector('#needle')
        if (needle === null) throw new Error('test setup')

        const result = liftToTopLevel(c, needle)
        expect(result.parentNode).toBe(c)
    })

    it('preserves document order — content that was after the lifted node remains after it', () => {
        const c = makeContainer(`
            <section><p>before-1</p><p id="from">CUT</p><p>after-1</p></section>
            <p>tail</p>
        `)
        const from = c.querySelector('#from')
        if (from === null) throw new Error('test setup')

        liftToTopLevel(c, from)
        const directChildren = [...c.children].map(el => el.tagName.toLowerCase()).join(',')
        expect(directChildren.startsWith('section')).toBe(true)
        // After lifting, the new top-level section (clone of the original) holds
        // the lifted node plus 'after-1'.
        const lastSection = c.querySelectorAll('section')[c.querySelectorAll('section').length - 1]
        expect(lastSection?.textContent).toContain('CUT')
        expect(lastSection?.textContent).toContain('after-1')
    })

    it('clones parent elements shallowly (no attribute on clone except those copied by cloneNode(false))', () => {
        const c = makeContainer('<section class="orig"><p class="inner">x<span data-needle="1">N</span></p></section>')
        const needle = c.querySelector('[data-needle]')
        if (needle === null) throw new Error('test setup')

        liftToTopLevel(c, needle)
        const sections = c.querySelectorAll('section')
        expect(sections.length).toBe(2)
        for (const sec of sections) {
            expect(sec.classList.contains('orig')).toBe(true)
        }
    })

    it('leaves left-side siblings inside the original parent', () => {
        const c = makeContainer('<section><p>L1</p><p id="cut">CUT</p><p>R1</p></section>')
        const cut = c.querySelector('#cut')
        if (cut === null) throw new Error('test setup')

        liftToTopLevel(c, cut)
        const firstSection = c.querySelector('section')
        expect(firstSection?.textContent).toContain('L1')
        expect(firstSection?.textContent).not.toContain('CUT')
        expect(firstSection?.textContent).not.toContain('R1')
    })
})
