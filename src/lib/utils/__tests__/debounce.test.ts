import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '@lib/utils'

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('fires the wrapped fn exactly once after the wait elapses', () => {
        const fn = vi.fn()
        const debounced = debounce(fn, 100)

        debounced()
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(99)
        expect(fn).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('collapses repeated calls within the wait window into a single trailing call', () => {
        const fn = vi.fn()
        const debounced = debounce(fn, 50)

        debounced()
        vi.advanceTimersByTime(20)
        debounced()
        vi.advanceTimersByTime(20)
        debounced()
        vi.advanceTimersByTime(20)
        debounced()

        vi.advanceTimersByTime(50)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('uses the args from the most recent call', () => {
        const fn = vi.fn<(a: number, b: string) => void>()
        const debounced = debounce(fn, 30)

        debounced(1, 'first')
        debounced(2, 'second')
        debounced(3, 'third')

        vi.advanceTimersByTime(30)
        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith(3, 'third')
    })

    it('fires again after a second wait window', () => {
        const fn = vi.fn()
        const debounced = debounce(fn, 25)

        debounced()
        vi.advanceTimersByTime(25)
        expect(fn).toHaveBeenCalledTimes(1)

        debounced()
        vi.advanceTimersByTime(25)
        expect(fn).toHaveBeenCalledTimes(2)
    })
})
