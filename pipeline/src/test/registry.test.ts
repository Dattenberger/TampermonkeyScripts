import { describe, expect, it } from 'vitest'
import { scripts, scriptVersion, userscriptHeader, type ScriptConfig } from '../../scripts.config.js'

const fake: ScriptConfig = {
    entry: 'src/scripts/fake/main.ts',
    outputFileName: 'fake.user.js',
    settings: ['fakeFactor'],
    userscript: {
        name: 'Fake',
        namespace: 'https://example.invalid/',
        description: 'Fake',
        match: ['https://example.invalid/*'],
        grant: ['GM_addStyle', 'GM_getValue'],
    },
}

describe('script registry', () => {
    it('sets the neutral author once and declares settings by name only', () => {
        for (const config of Object.values(scripts)) {
            expect(config.userscript).not.toHaveProperty('author')
            expect(userscriptHeader(config, '1.0.0').author).toBe('Robotico')
            for (const name of config.settings ?? []) expect(name).toMatch(/^\w+$/)
        }
    })

    it('derives the storage and menu grants from declared settings, once each', () => {
        const grants = ['GM_addStyle', 'GM_getValue', 'GM_setValue', 'GM_registerMenuCommand']
        expect(userscriptHeader(fake, '1.0.0').grant).toEqual(grants)
        expect(userscriptHeader({ ...fake, settings: undefined }, '1.0.0').grant).toEqual(['GM_addStyle', 'GM_getValue'])
    })

    it('takes the version from versions.json, never from the registry', () => {
        for (const [name, config] of Object.entries(scripts)) {
            expect(config.userscript).not.toHaveProperty('version')
            expect(scriptVersion(name)).toMatch(/^\d+\.\d+\.\d+$/)
            expect(userscriptHeader(config, scriptVersion(name)).version).toBe(scriptVersion(name))
        }
        expect(scriptVersion('not-registered')).toBe('0.0.0')
    })

    it("refuses declared settings together with the 'none' grant", () => {
        const none = { ...fake, userscript: { ...fake.userscript, grant: ['none'] } }
        expect(() => userscriptHeader(none, '1.0.0')).toThrow(/none/)
    })
})
