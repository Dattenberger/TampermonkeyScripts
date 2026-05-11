import { describe, expect, it } from 'vitest'
import { processIframe } from '../iframe/setup.js'
import { injectStyles } from '../iframe/styles.js'
import { updateIframeHeight } from '../iframe/height.js'
import { setupClickDelegation } from '../iframe/click-delegation.js'
import { CFG, STYLE_MARKER_ATTR } from '../config.js'

function makeIframe(innerBodyHtml: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe')
    document.body.append(iframe)
    const doc = iframe.contentDocument
    if (doc === null) throw new Error('jsdom did not give us a contentDocument')
    doc.body.innerHTML = innerBodyHtml
    return iframe
}

describe('injectStyles', () => {
    it('injects exactly one <style data-gh-qc> element per document', () => {
        const iframe = makeIframe('<p>x</p>')
        const doc = iframe.contentDocument!

        injectStyles(doc)
        injectStyles(doc)
        injectStyles(doc)

        const styles = doc.querySelectorAll(`style[${STYLE_MARKER_ATTR}]`)
        expect(styles.length).toBe(1)
    })
})

describe('updateIframeHeight', () => {
    it('writes a px height onto the iframe element', () => {
        const iframe = makeIframe('<p style="height:200px">tall</p>')
        // jsdom does not compute real layout; we patch scrollHeight to a
        // deterministic value so the math is testable.
        const doc = iframe.contentDocument!
        Object.defineProperty(doc.body, 'scrollHeight', { value: 350, configurable: true })
        Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 300, configurable: true })

        updateIframeHeight(iframe)
        expect(iframe.style.height).toBe('350px')
    })
})

describe('setupClickDelegation', () => {
    it('toggles the wrapper visible-class on button click and updates the label', () => {
        const iframe = makeIframe(`
            <button type="button" class="${CFG.btnClass} ${CFG.btnQuoteClass}" data-label="Älteren Verlauf">↓ Älteren Verlauf anzeigen</button>
            <div class="${CFG.wrapperClass}">hidden content</div>
        `)
        const doc = iframe.contentDocument!
        Object.defineProperty(doc.body, 'scrollHeight', { value: 100, configurable: true })
        Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 100, configurable: true })

        setupClickDelegation(iframe, doc)

        const btn = doc.querySelector(`.${CFG.btnClass}`) as HTMLButtonElement
        const wrapper = doc.querySelector(`.${CFG.wrapperClass}`)
        expect(btn).not.toBeNull()
        expect(wrapper).not.toBeNull()

        btn.click()
        expect(wrapper?.classList.contains(CFG.visibleClass)).toBe(true)
        expect(btn.textContent).toContain('ausblenden')

        btn.click()
        expect(wrapper?.classList.contains(CFG.visibleClass)).toBe(false)
        expect(btn.textContent).toContain('anzeigen')
    })

    it('ignores clicks that are not on toggle buttons', () => {
        const iframe = makeIframe(`<div class="${CFG.wrapperClass}">x</div><span id="other">click me</span>`)
        const doc = iframe.contentDocument!
        setupClickDelegation(iframe, doc)

        const wrapper = doc.querySelector(`.${CFG.wrapperClass}`)
        const span = doc.querySelector('#other') as HTMLElement
        span.click()
        expect(wrapper?.classList.contains(CFG.visibleClass)).toBe(false)
    })
})

describe('processIframe', () => {
    it('only processes a given document once (idempotent)', () => {
        const iframe = makeIframe('<p>Hallo,</p><p>-----Ursprüngliche Daten-----</p><p>quoted</p>')
        const doc = iframe.contentDocument!
        Object.defineProperty(doc.body, 'scrollHeight', { value: 200, configurable: true })
        Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 200, configurable: true })

        processIframe(iframe, 'incoming')
        const wrappersAfterFirst = doc.querySelectorAll(`.${CFG.wrapperClass}`).length
        processIframe(iframe, 'incoming')
        const wrappersAfterSecond = doc.querySelectorAll(`.${CFG.wrapperClass}`).length

        expect(wrappersAfterFirst).toBeGreaterThanOrEqual(1)
        expect(wrappersAfterSecond).toBe(wrappersAfterFirst)
    })

    it('injects styles and adds a toggle button + collapsed wrapper for an incoming mail with a quote marker', () => {
        const iframe = makeIframe('<p>reply</p><p>-----Ursprüngliche Daten-----</p><p>quoted</p>')
        const doc = iframe.contentDocument!
        Object.defineProperty(doc.body, 'scrollHeight', { value: 200, configurable: true })
        Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 200, configurable: true })

        processIframe(iframe, 'incoming')

        expect(doc.querySelectorAll(`style[${STYLE_MARKER_ATTR}]`).length).toBe(1)
        expect(doc.querySelector(`.${CFG.btnClass}`)).not.toBeNull()
        expect(doc.querySelector(`.${CFG.wrapperClass}`)).not.toBeNull()
    })
})
