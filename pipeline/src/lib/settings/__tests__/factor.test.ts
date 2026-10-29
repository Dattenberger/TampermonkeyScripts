import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFactor, parseFactor, registerFactorMenu } from '@lib/settings'

const setting = { key: 'testFactor', label: 'Test-Faktor' }

describe('factor setting', () => {
    const prompt = vi.fn<(message?: string, value?: string) => string | null>()
    const alert = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        prompt.mockReset()
        vi.stubGlobal('prompt', prompt)
        vi.stubGlobal('alert', alert)
    })

    it('accepts comma or dot decimals in (0, 1] and refuses everything else', () => {
        expect(parseFactor('0,123')).toBe(0.123)
        expect(parseFactor(' 0.123 ')).toBe(0.123)
        expect(parseFactor(1)).toBe(1)
        const bad = ['0', '-0.1', '1.001', 'abc', '', null, undefined, '0,123abc', '0,123,456', '0.123.456', '1/2', '1e-1']
        for (const input of bad) expect(parseFactor(input)).toBeNull()
    })

    it('asks on first use and stores the answer', () => {
        prompt.mockReturnValueOnce('0,123')
        expect(getFactor(setting)).toBe(0.123)
        expect(prompt).toHaveBeenCalledTimes(1)
        expect(GM_getValue('testFactor')).toBe(0.123)
    })

    it('uses a stored value without asking', () => {
        GM_setValue('testFactor', 0.123)
        expect(getFactor(setting)).toBe(0.123)
        expect(prompt).not.toHaveBeenCalled()
    })

    it('refuses invalid input and asks again', () => {
        prompt.mockReturnValueOnce('2').mockReturnValueOnce('0.123')
        expect(getFactor(setting)).toBe(0.123)
        expect(alert).toHaveBeenCalledTimes(1)
        expect(prompt).toHaveBeenCalledTimes(2)
    })

    it('stores nothing when the user cancels', () => {
        prompt.mockReturnValueOnce(null)
        expect(getFactor(setting)).toBeNull()
        expect(GM_setValue).not.toHaveBeenCalled()
        expect(GM_getValue('testFactor')).toBeUndefined()
    })

    it('registers a menu entry that asks again and stores the new value', () => {
        registerFactorMenu(setting, 'Test-Faktor ändern')
        const call = vi.mocked(GM_registerMenuCommand).mock.calls[0]!
        expect(call[0]).toBe('Test-Faktor ändern')
        prompt.mockReturnValueOnce('0,456')
        call[1]()
        expect(GM_getValue('testFactor')).toBe(0.456)
    })
})
