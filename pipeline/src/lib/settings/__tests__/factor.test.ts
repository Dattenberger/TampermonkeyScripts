import { beforeEach, describe, expect, it, vi } from 'vitest'
import { discountPercentInput, formatDiscountPercent, parseDiscountPercent, parseFactor, readFactor } from '@lib/settings'

const setting = { key: 'testFactor', label: 'Test-Faktor' }

/** A random factor in (0, 1) with three decimals, so no test carries a fixed factor value. */
const randomFactor = () => (1 + Math.floor(Math.random() * 998)) / 1000
/** The percentage the field shows for a factor with three decimals. */
const shown = (factor: number) => String(Math.round((1 - factor) * 1000) / 10).replace('.', ',')

function type(input: HTMLInputElement, text: string): void {
    input.value = text
    input.dispatchEvent(new Event('input'))
}

describe('factor setting', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('accepts comma or dot decimals in (0, 1] and refuses everything else', () => {
        expect(parseFactor('0,123')).toBe(0.123)
        expect(parseFactor(' 0.123 ')).toBe(0.123)
        expect(parseFactor(1)).toBe(1)
        expect(parseFactor(',5')).toBe(0.5)
        expect(parseFactor('.5')).toBe(0.5)
        // A stored number counts only if the field can show it: 1e-21 would read as '0'.
        expect(parseFactor(0.000_000_1)).toBe(0.000_000_1)
        expect(parseFactor(1e-21)).toBeNull()
        expect(parseFactor('0,' + '0'.repeat(20) + '1')).toBeNull()
        const bad = ['0', '-0.1', '1.001', 'abc', '', null, undefined, '0,123abc', '0,123,456', '0.123.456', '1/2', '1e-1']
        for (const input of bad) expect(parseFactor(input)).toBeNull()
    })

    it('turns a typed percentage into the factor and back, and refuses anything outside [0, 100)', () => {
        for (let i = 0; i < 20; i += 1) {
            const factor = randomFactor()
            expect(parseDiscountPercent(shown(factor))).toBe(factor)
            expect(formatDiscountPercent(factor)).toBe(shown(factor))
        }
        expect(parseDiscountPercent('0')).toBe(1)
        expect(parseDiscountPercent(' 12,5 % ')).toBe(0.875)
        expect(parseDiscountPercent('12.5%')).toBe(0.875)
        for (const bad of ['100', '150', '-1', 'abc', '', '%', '2,5,1', '99,999999999999']) expect(parseDiscountPercent(bad)).toBeNull()
        // A stored factor from before the percent field reads back as its percentage.
        expect(formatDiscountPercent(1)).toBe('0')
        expect(formatDiscountPercent(0.000_000_1)).toBe('99,99999')
    })

    it('reads nothing but a valid stored factor', () => {
        expect(readFactor(setting)).toBeNull()
        const factor = randomFactor()
        GM_setValue(setting.key, factor)
        expect(readFactor(setting)).toBe(factor)
        GM_setValue(setting.key, 'abc')
        expect(readFactor(setting)).toBeNull()
    })

    it('shows the stored value in the form it accepts, and does not mark an untouched empty field', () => {
        expect(discountPercentInput(setting).getAttribute('aria-invalid')).toBeNull()
        const factor = randomFactor()
        GM_setValue(setting.key, factor)
        const input = discountPercentInput(setting)
        expect(input.value).toBe(shown(factor))
    })

    it('stores a valid input at once, and an empty or invalid one removes the value and stays visible', () => {
        const input = discountPercentInput(setting)
        const factor = randomFactor()
        type(input, shown(factor))
        expect(readFactor(setting)).toBe(factor)
        expect(input.getAttribute('aria-invalid')).toBe('false')
        for (const bad of ['', '100']) {
            type(input, shown(factor))
            type(input, bad)
            expect(readFactor(setting)).toBeNull()
            expect(input.getAttribute('aria-invalid')).toBe('true')
            input.dispatchEvent(new Event('blur'))
            expect(input.value).toBe(bad)
        }
    })

    it('follows a change from another tab, not its own', () => {
        const input = discountPercentInput(setting)
        const listener = vi.mocked(GM_addValueChangeListener).mock.calls.at(-1)![1]
        const first = randomFactor()
        GM_setValue(setting.key, first)
        listener(setting.key, undefined, first, true)
        expect(input.value).toBe(shown(first))
        input.value = 'im Tippen'
        listener(setting.key, first, first, false)
        expect(input.value).toBe('im Tippen')
    })
})
