import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The hand-written root scripts cannot import @lib/settings, so each carries the same block. This
// pins that block's behaviour and that no script holds a purchase condition again.
const SCRIPTS = ['hsqvrn_protal_cart_exporter.js', 'hsqvrn_protal_orders_exporter.js', 'weborder.js', 'weborder_v2.js']
const KEY = 'husqvarnaDiscountFactor'
const read = (name: string) => readFileSync(path.join(__dirname, '..', '..', '..', name), 'utf8').replaceAll('\r\n', '\n')
const block = (source: string) => /\/\/ --- local discount factor ---[\s\S]*?\/\/ --- end local discount factor ---/.exec(source)?.[0] ?? ''

interface Block {
    parseFactor: (input: unknown) => number | null
    readFactor: () => number | null
    parseDiscountPercent: (input: string) => number | null
    formatDiscountPercent: (factor: number) => string
    showDiscountCard: (open?: boolean, onChange?: () => void) => HTMLElement
}

function load(source: string): Block {
    // Runs the block as the script does, from this repository's own file.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function(`${block(source)}\nreturn { parseFactor, readFactor, parseDiscountPercent, formatDiscountPercent, showDiscountCard }`) as () => Block
    return run()
}

/** A random factor in (0, 1) with three decimals, so no test carries a fixed value. */
const randomFactor = () => (1 + Math.floor(Math.random() * 998)) / 1000
/** The percentage the card shows for such a factor. */
const percentOf = (factor: number) => String(Math.round((1 - factor) * 1000) / 10).replace('.', ',')

function type(input: HTMLInputElement, text: string): void {
    input.value = text
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('change'))
}

describe('local discount factor in the root scripts', () => {
    const first = block(read(SCRIPTS[0]!))
    let script: Block

    beforeEach(() => {
        vi.clearAllMocks()
        document.head.innerHTML = ''
        document.body.innerHTML = ''
        GM_setValue(KEY, undefined)
        // A fresh block per test, as every page load runs the script anew.
        script = load(read(SCRIPTS[0]!))
    })

    it.each(SCRIPTS)('%s has the block, its grants, no menu and no number where the factor goes', (name) => {
        const source = read(name)
        expect(first).not.toBe('')
        expect(block(source)).toBe(first)
        for (const grant of ['GM_getValue', 'GM_setValue']) expect(source).toContain(`// @grant        ${grant}\n`)
        expect(source).not.toContain('// @grant        none')
        expect(source).not.toMatch(/askFactor|GM_registerMenuCommand|prompt\(/)
        expect(source).toMatch(/showDiscountCard\(readFactor\(\) === null/)
        expect(source).not.toMatch(/(?:factor|faktor)\w*["']?\s*[:=]\s*\d/i)
        expect(source).not.toMatch(/\*\s*0[.,]\d/)
        expect(source).not.toMatch(/\d\s*%\s*(?:rabatt|skonto)/i)
    })

    it('reads only a valid factor', () => {
        expect(script.readFactor()).toBeNull()
        const factor = randomFactor()
        GM_setValue(KEY, factor)
        expect(script.readFactor()).toBe(factor)
        for (const bad of ['abc', 0, 2, -1, '']) expect(script.parseFactor(bad)).toBeNull()
        // String(1e-7) is '1e-7': a stored number must not pass through the text form.
        expect(script.parseFactor(1e-7)).toBe(1e-7)
    })

    it('turns a typed percentage into the factor and back, and refuses anything outside [0, 100)', () => {
        for (let i = 0; i < 20; i += 1) {
            const factor = randomFactor()
            expect(script.parseDiscountPercent(percentOf(factor))).toBe(factor)
            expect(script.formatDiscountPercent(factor)).toBe(percentOf(factor))
        }
        expect(script.parseDiscountPercent('0')).toBe(1)
        expect(script.parseDiscountPercent(' 12,5 % ')).toBe(0.875)
        for (const bad of ['100', '-1', 'abc', '', '%', '2,5,1']) expect(script.parseDiscountPercent(bad)).toBeNull()
    })

    it('opens the card without a value, stores what is typed as the factor and folds it on Escape', () => {
        const card = script.showDiscountCard(true)
        const input = card.querySelector('input')!
        expect(card.classList.contains('is-open')).toBe(true)
        expect(card.textContent).toContain('Skonto fehlt')
        expect(card.textContent).toContain('Robotico · JTL')
        expect(document.activeElement).toBe(input)
        const factor = randomFactor()
        type(input, `${percentOf(factor)} %`)
        expect(GM_getValue(KEY)).toBe(factor)
        expect(input.getAttribute('aria-invalid')).toBe('false')
        expect(card.textContent).toContain('Skonto ✓')
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        expect(card.classList.contains('is-open')).toBe(false)
        type(input, '100')
        expect(script.readFactor()).toBeNull()
        expect(input.getAttribute('aria-invalid')).toBe('true')
        expect(card.classList.contains('is-missing')).toBe(true)
    })

    it('shows a stored factor folded, as its percentage, once per page; the head unfolds it', () => {
        const factor = randomFactor()
        GM_setValue(KEY, factor)
        const card = script.showDiscountCard(false)
        script.showDiscountCard(false)
        expect(document.querySelectorAll('#robotico-discount-card')).toHaveLength(1)
        expect(card.classList.contains('is-open')).toBe(false)
        expect(card.querySelector('input')!.value).toBe(percentOf(factor))
        card.querySelector<HTMLButtonElement>('.rd-head')!.click()
        expect(card.classList.contains('is-open')).toBe(true)
        expect(card.querySelector('.rd-head')!.getAttribute('aria-expanded')).toBe('true')
    })

    it('calls back once a valid value is left, not for an invalid one', () => {
        const changed = vi.fn()
        const input = script.showDiscountCard(true, changed).querySelector('input')!
        type(input, 'abc')
        expect(changed).not.toHaveBeenCalled()
        type(input, percentOf(randomFactor()))
        expect(changed).toHaveBeenCalledTimes(1)
    })
})
