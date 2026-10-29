import { describe, expect, it } from 'vitest'
import { scripts, userscriptHeader, type ScriptConfig } from '../../scripts.config.js'

const fake: ScriptConfig = {
    entry: 'src/scripts/fake/main.ts',
    outputFileName: 'fake.user.js',
    settings: ['fakeFactor'],
    userscript: {
        name: 'Fake',
        namespace: 'https://example.invalid/',
        version: '0.0.1',
        description: 'Fake',
        match: ['https://example.invalid/*'],
        grant: ['GM_addStyle', 'GM_getValue'],
    },
}

describe('script registry', () => {
    it('sets the neutral author once and declares settings by name only', () => {
        for (const config of Object.values(scripts)) {
            expect(config.userscript).not.toHaveProperty('author')
            expect(userscriptHeader(config).author).toBe('Robotico')
            for (const name of config.settings ?? []) expect(name).toMatch(/^\w+$/)
        }
    })

    it('derives the storage and menu grants from declared settings, once each', () => {
        const grants = ['GM_addStyle', 'GM_getValue', 'GM_setValue', 'GM_registerMenuCommand']
        expect(userscriptHeader(fake).grant).toEqual(grants)
        expect(userscriptHeader({ ...fake, settings: undefined }).grant).toEqual(['GM_addStyle', 'GM_getValue'])
    })
})
