import { describe, expect, it } from 'vitest'
import { nonEmpty, truncate } from '@lib/utils'

describe('nonEmpty', () => {
    it('returns false for null and undefined', () => {
        expect(nonEmpty(null)).toBe(false)
        expect(nonEmpty(undefined)).toBe(false)
    })

    it('returns false for the empty string', () => {
        expect(nonEmpty('')).toBe(false)
    })

    it('returns true for any non-empty string', () => {
        expect(nonEmpty('x')).toBe(true)
        expect(nonEmpty(' ')).toBe(true)
    })
})

describe('truncate', () => {
    it('returns the input untouched when within limit', () => {
        expect(truncate('hello', 10)).toBe('hello')
        expect(truncate('hello', 5)).toBe('hello')
    })

    it('truncates with an ellipsis suffix by default', () => {
        expect(truncate('hello world', 8)).toBe('hello w…')
    })

    it('honours a custom ellipsis token', () => {
        expect(truncate('hello world', 8, '...')).toBe('hello...')
    })
})
