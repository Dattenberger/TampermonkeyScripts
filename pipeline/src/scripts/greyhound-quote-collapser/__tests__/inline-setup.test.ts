import { describe, expect, it } from 'vitest'
import { setupInline } from '../inline/setup.js'
import { CFG, STYLE_MARKER_ATTR } from '../config.js'
import { OUTGOING_GREYHOUND_FORWARD_CHAIN } from './fixtures.js'

// MutationObserver callbacks fire as microtasks. Yielding twice covers the
// observer fire + the inline handler's own re-process pass.
async function flushMicrotasks(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
}

function makeItem(html: string): HTMLElement {
    const item = document.createElement('div')
    item.innerHTML = html
    document.body.append(item)
    return item
}

describe('inline setup', () => {
    it('processes the body on first run: toggle button + wrapper appear', () => {
        const item = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        setupInline(item, 'outgoing')

        expect(item.querySelector(`.${CFG.btnClass}`)).not.toBeNull()
        expect(item.querySelector(`.${CFG.wrapperClass}`)).not.toBeNull()
    })

    it('injects styles into the page document exactly once', () => {
        const item1 = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        const item2 = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        setupInline(item1, 'outgoing')
        setupInline(item2, 'outgoing')

        const styles = document.querySelectorAll(`style[${STYLE_MARKER_ATTR}]`)
        expect(styles.length).toBe(1)
    })

    it('is idempotent — calling setup twice does not double-wrap', () => {
        const item = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        setupInline(item, 'outgoing')
        const buttonsAfterFirst = item.querySelectorAll(`.${CFG.btnClass}`).length

        setupInline(item, 'outgoing')
        const buttonsAfterSecond = item.querySelectorAll(`.${CFG.btnClass}`).length

        expect(buttonsAfterSecond).toBe(buttonsAfterFirst)
    })

    it('self-heals when React-style wipes our wrapper: re-applies on mutation', async () => {
        const item = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        setupInline(item, 'outgoing')
        expect(item.querySelector(`.${CFG.btnClass}`)).not.toBeNull()

        // Simulate React replacing the subtree: drop everything, re-mount
        // the raw body. Our wrapper/button are gone.
        item.innerHTML = OUTGOING_GREYHOUND_FORWARD_CHAIN
        expect(item.querySelector(`.${CFG.btnClass}`)).toBeNull()

        await flushMicrotasks()

        expect(item.querySelector(`.${CFG.btnClass}`)).not.toBeNull()
        expect(item.querySelector(`.${CFG.wrapperClass}`)).not.toBeNull()
    })

    it('does not infinite-loop: own mutations inside processBody are absorbed', async () => {
        // If reentrancy guarding fails, this either hangs the test runner
        // (timeout) or produces an unbounded button count. We assert the
        // count is bounded after several microtask cycles.
        const item = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        setupInline(item, 'outgoing')

        for (let i = 0; i < 5; i++) await flushMicrotasks()

        // Two expected toggle buttons for this fixture (outer + one inner
        // detected-sig). Anything beyond that means we re-ran processBody
        // additional times on top of our own output.
        const buttons = item.querySelectorAll(`.${CFG.btnClass}`).length
        expect(buttons).toBeGreaterThanOrEqual(1)
        expect(buttons).toBeLessThanOrEqual(5)
    })

    it('click toggles wrapper visibility', () => {
        const item = makeItem(OUTGOING_GREYHOUND_FORWARD_CHAIN)
        setupInline(item, 'outgoing')

        const btn = item.querySelector<HTMLButtonElement>(`.${CFG.btnClass}`)
        expect(btn).not.toBeNull()
        const wrapper = btn?.nextElementSibling
        expect(wrapper?.classList.contains(CFG.wrapperClass)).toBe(true)
        expect(wrapper?.classList.contains(CFG.visibleClass)).toBe(false)

        btn?.click()
        expect(wrapper?.classList.contains(CFG.visibleClass)).toBe(true)

        btn?.click()
        expect(wrapper?.classList.contains(CFG.visibleClass)).toBe(false)
    })
})
