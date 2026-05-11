import { describe, expect, it } from 'vitest'
import { cleanupWhitespace } from '../body/cleanup.js'
import { CFG } from '../config.js'

function makeContainer(html: string): HTMLElement {
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.append(div)
    return div
}

// Helper: serialise <p> contents to a strings, distinguishing empty <p>s
// (rendered as '') from content <p>s (rendered as their textContent).
function paragraphs(root: Element): string[] {
    return [...root.querySelectorAll('p')].map((p) => p.textContent ?? '')
}

describe('cleanupWhitespace — trim + collapse-runs semantics', () => {
    describe('run collapse (max one empty <p> between content)', () => {
        it('keeps a single empty <p> between content', () => {
            const c = makeContainer('<p>a</p><p></p><p>b</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['a', '', 'b'])
        })

        it('collapses two consecutive empty <p>s in the middle to one', () => {
            const c = makeContainer('<p>a</p><p></p><p></p><p>b</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['a', '', 'b'])
        })

        it('collapses three consecutive empty <p>s in the middle to one', () => {
            const c = makeContainer('<p>a</p><p></p><p></p><p></p><p>b</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['a', '', 'b'])
        })

        it('treats whitespace-only and &nbsp; <p>s as empty for the run rule', () => {
            const c = makeContainer('<p>a</p><p>   </p><p>&nbsp;</p><p>\n</p><p>b</p>')
            cleanupWhitespace(c)
            // First whitespace-only <p> is between real content → kept (1 empty allowed).
            // Remaining two empties of the run → removed.
            expect(c.querySelectorAll('p').length).toBe(3)
            const ps = [...c.querySelectorAll('p')]
            expect(ps[0]?.textContent).toBe('a')
            expect(ps[2]?.textContent).toBe('b')
            // The middle <p> is whatever-the-first-empty-of-the-run was — content
            // is irrelevant, what matters is exactly one empty <p> survives.
        })
    })

    describe('leading trim (no whitespace at the very front)', () => {
        it('removes a single leading empty <p>', () => {
            const c = makeContainer('<p></p><p>content</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['content'])
        })

        it('removes multiple leading empty <p>s', () => {
            const c = makeContainer('<p></p><p>&nbsp;</p><p></p><p>content</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['content'])
        })

        it('treats whitespace-only text nodes between leading empties as transparent', () => {
            const c = makeContainer('<p></p>\n\n<p></p>\n<p>content</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['content'])
        })
    })

    describe('trailing trim (no whitespace at the very end)', () => {
        it('removes a single trailing empty <p>', () => {
            const c = makeContainer('<p>content</p><p></p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['content'])
        })

        it('removes multiple trailing empty <p>s', () => {
            const c = makeContainer('<p>content</p><p></p><p>&nbsp;</p><p></p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['content'])
        })

        it('strips trailing empties even when separated by whitespace text', () => {
            const c = makeContainer('<p>content</p>\n<p></p>\n\n<p></p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['content'])
        })
    })

    describe('all-empty container', () => {
        it('removes every empty <p> when none of them is between content', () => {
            const c = makeContainer('<p></p><p></p><p></p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual([])
        })
    })

    describe('preservation rules', () => {
        it('keeps <p>s with non-whitespace text', () => {
            const c = makeContainer('<p>Hello</p><p>World</p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['Hello', 'World'])
        })

        it('keeps <p>s containing images, links, buttons or other media', () => {
            const c = makeContainer(`
                <p><img src="data:," alt=""></p>
                <p><a href="#x"></a></p>
                <p><button type="button"></button></p>
                <p><iframe></iframe></p>
                <p></p>
            `)
            cleanupWhitespace(c)
            // Four media-bearing <p>s + the trailing empty: empty is trailing → removed.
            expect(c.querySelectorAll('p').length).toBe(4)
        })

        it('never removes <p>s carrying the wrapper or btn class', () => {
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

    describe('recursive containers', () => {
        it('applies trim + collapse inside nested elements independently', () => {
            const c = makeContainer(`
                <span><p></p><p>visible body</p><p></p></span>
                <div class="${CFG.wrapperClass}">
                    <span><p></p><p>collapsed</p><p></p><p></p><p>tail</p><p></p></span>
                </div>
            `)
            cleanupWhitespace(c)
            const outerSpan = c.querySelector('span')
            const innerSpan = c.querySelector(`.${CFG.wrapperClass} span`)
            expect(paragraphs(outerSpan as Element)).toEqual(['visible body'])
            // Inner: leading empty removed, single empty in middle removed
            // (preceding sibling 'collapsed' is content, but it's not collapsed
            // — it's part of a 2-empty run between 'collapsed' and 'tail' →
            // first kept, second removed → ['collapsed', '', 'tail']),
            // trailing empty removed.
            expect(paragraphs(innerSpan as Element)).toEqual(['collapsed', '', 'tail'])
        })

        it('keeps a middle empty <p> even when leading and trailing are present', () => {
            const c = makeContainer('<p></p><p>a</p><p></p><p>b</p><p></p>')
            cleanupWhitespace(c)
            expect(paragraphs(c)).toEqual(['a', '', 'b'])
        })
    })
})
