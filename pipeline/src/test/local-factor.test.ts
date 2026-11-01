import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The hand-written root scripts cannot import @lib/settings, so each carries the same block. This
// pins that block's behaviour and that no script holds a purchase condition again.
const SCRIPTS = ['hsqvrn_protal_cart_exporter.js', 'hsqvrn_protal_orders_exporter.js', 'weborder.js', 'weborder_v2.js']
const read = (name: string) => readFileSync(path.join(__dirname, '..', '..', '..', name), 'utf8')
const block = (source: string) => /\/\/ --- local discount factor ---[\s\S]*?\/\/ --- end local discount factor ---/.exec(source)?.[0] ?? ''

interface Block {
    parseFactor: (input: unknown) => number | null
    readFactor: () => number | null
    askFactor: () => number | null
}

function load(source: string): Block {
    // Runs the block as the script does, from this repository's own file.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function(`${block(source)}\nreturn { parseFactor, readFactor, askFactor }`) as () => Block
    return run()
}

/** A random factor in (0, 1), so no test carries a fixed value. */
const randomFactor = () => (1 + Math.floor(Math.random() * 998)) / 1000

describe('local discount factor in the root scripts', () => {
    const first = block(read(SCRIPTS[0]!))
    const script = load(read(SCRIPTS[0]!))

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('alert', vi.fn())
        GM_setValue('husqvarnaDiscountFactor', undefined)
    })

    it.each(SCRIPTS)('%s has the block, its grants and no number where the factor goes', (name) => {
        const source = read(name)
        expect(first).not.toBe('')
        expect(block(source)).toBe(first)
        for (const grant of ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand']) expect(source).toContain(`// @grant        ${grant}\n`)
        expect(source).not.toContain('// @grant        none')
        expect(source).not.toMatch(/(?:factor|faktor)\w*["']?\s*[:=]\s*\d/i)
        expect(source).not.toMatch(/\*\s*0[.,]\d/)
        expect(source).not.toMatch(/\d\s*%\s*(?:rabatt|skonto)/i)
    })

    it('reads only a valid factor', () => {
        expect(script.readFactor()).toBeNull()
        const factor = randomFactor()
        GM_setValue('husqvarnaDiscountFactor', factor)
        expect(script.readFactor()).toBe(factor)
        for (const bad of ['abc', 0, 2, -1, '']) expect(script.parseFactor(bad)).toBeNull()
        // String(1e-7) is '1e-7': a stored number must not pass through the text form.
        expect(script.parseFactor(1e-7)).toBe(1e-7)
    })

    it('asks until the input is valid, stores it, and stores nothing when cancelled', () => {
        const factor = randomFactor()
        const prompt = vi.fn<() => string | null>().mockReturnValueOnce('2').mockReturnValueOnce(String(factor).replace('.', ','))
        vi.stubGlobal('prompt', prompt)
        expect(script.askFactor()).toBe(factor)
        expect(prompt).toHaveBeenCalledTimes(2)
        expect(GM_getValue('husqvarnaDiscountFactor')).toBe(factor)
        GM_setValue('husqvarnaDiscountFactor', undefined)
        vi.stubGlobal('prompt', vi.fn(() => null))
        expect(script.askFactor()).toBeNull()
        expect(GM_getValue('husqvarnaDiscountFactor')).toBeUndefined()
    })
})
