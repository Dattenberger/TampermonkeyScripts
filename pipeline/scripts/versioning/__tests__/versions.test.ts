import { describe, expect, it } from 'vitest'
import { bump, contentHash, expectedVersions, INITIAL_VERSION, levelFromLabels, versionProblems, type Versions } from '../versions.js'

const bundle = (version: string, body: string) => `// ==UserScript==\n// @name         X\n// @version      ${version}\n// ==/UserScript==\n${body}`

const base: Versions = { a: { version: '1.4.2', sha256: 'old' } }

describe('versions', () => {
    it('bumps patch, minor and major', () => {
        expect(bump('1.4.2', 'patch')).toBe('1.4.3')
        expect(bump('1.4.2', 'minor')).toBe('1.5.0')
        expect(bump('1.4.2', 'major')).toBe('2.0.0')
        expect(() => bump('1.4', 'patch')).toThrow(/not a version/)
    })

    it('hashes the bundle without its version line', () => {
        expect(contentHash(bundle('1.0.0', 'code'))).toBe(contentHash(bundle('9.9.9', 'code')))
        expect(contentHash(bundle('1.0.0', 'code'))).not.toBe(contentHash(bundle('1.0.0', 'other')))
    })

    it('reads the level from release labels, patch by default', () => {
        expect(levelFromLabels([])).toBe('patch')
        expect(levelFromLabels(['documentation', 'release:minor'])).toBe('minor')
        expect(levelFromLabels(['release:minor', 'release:major'])).toBe('major')
    })

    it('keeps the entry of an unchanged script', () => {
        expect(expectedVersions({ base, current: base, hashes: { a: 'old' }, level: 'patch' })).toEqual(base)
    })

    it('bumps a changed script once against main, whatever the branch did before', () => {
        const current: Versions = { a: { version: '1.4.2', sha256: 'old' } }
        expect(expectedVersions({ base, current, hashes: { a: 'new' }, level: 'keep' }).a).toEqual({ version: '1.4.3', sha256: 'new' })
        expect(expectedVersions({ base, current, hashes: { a: 'new' }, level: 'minor' }).a?.version).toBe('1.5.0')
    })

    it('bumps a revert too: the old bundle comes back under a new version', () => {
        const onMain: Versions = { a: { version: '1.4.3', sha256: 'new' } }
        const reverted: Versions = { a: { version: '1.4.2', sha256: 'old' } }
        const expected = expectedVersions({ base: onMain, current: reverted, hashes: { a: 'old' }, level: 'keep' })
        expect(expected.a).toEqual({ version: '1.4.4', sha256: 'old' })
        expect(versionProblems(reverted, expected)).toEqual(['a: version 1.4.2, expected 1.4.4'])
    })

    it("keeps a minor or major bump the branch carries when the level is 'keep'", () => {
        const current: Versions = { a: { version: '2.0.0', sha256: 'stale' } }
        expect(expectedVersions({ base, current, hashes: { a: 'new' }, level: 'keep' }).a?.version).toBe('2.0.0')
        expect(expectedVersions({ base, current, hashes: { a: 'new' }, level: 'patch' }).a?.version).toBe('1.4.3')
    })

    it('starts a script that is new on this branch at the initial version', () => {
        expect(expectedVersions({ base, current: base, hashes: { a: 'old', b: 'h' }, level: 'major' }).b).toEqual({
            version: INITIAL_VERSION,
            sha256: 'h',
        })
    })

    it('names every difference to the expected entries', () => {
        const expected: Versions = { a: { version: '1.4.3', sha256: 'new' }, b: { version: '1.0.0', sha256: 'h' } }
        const current: Versions = { a: { version: '1.4.3', sha256: 'stale' }, gone: { version: '1.0.0', sha256: 'x' } }
        expect(versionProblems(current, expected)).toEqual([
            'a: recorded hash does not match the built bundle',
            'b: missing, expected 1.0.0',
            'gone: recorded but not in the registry',
        ])
        expect(versionProblems(expected, expected)).toEqual([])
    })
})
