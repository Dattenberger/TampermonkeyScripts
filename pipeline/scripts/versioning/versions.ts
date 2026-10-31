// Version rules for the built userscripts. `versions.json` records, per script, the version and a
// hash of the bundle without its `@version` line; only `npm run version:update` writes it. A script
// whose bundle hash differs from the one recorded on main gets the next version, so every delivered
// change — a revert included — reaches Tampermonkey's update check, and nobody bumps by hand.

import { createHash } from 'node:crypto'

export type Level = 'patch' | 'minor' | 'major'

export interface VersionEntry {
    version: string
    sha256: string
}

export type Versions = Record<string, VersionEntry>

/** Version of a script that is not on main yet. */
export const INITIAL_VERSION = '1.0.0'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const VERSION_LINE = /^\/\/ @version[^\n]*\n/m
const LEVELS: readonly Level[] = ['patch', 'minor', 'major']

function parse(version: string): [number, number, number] {
    const match = SEMVER.exec(version)
    if (!match) throw new Error(`not a version: "${version}"`)
    return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function bump(version: string, level: Level): string {
    const [major, minor, patch] = parse(version)
    if (level === 'major') return `${major + 1}.0.0`
    if (level === 'minor') return `${major}.${minor + 1}.0`
    return `${major}.${minor}.${patch + 1}`
}

/** Hash of a bundle without its `@version` line, so the version itself never counts as a change. */
export function contentHash(bundle: string): string {
    return createHash('sha256').update(bundle.replace(VERSION_LINE, '')).digest('hex')
}

/** The level a PR's labels ask for: `release:major` over `release:minor`, else patch. */
export function levelFromLabels(labels: readonly string[]): Level {
    if (labels.includes('release:major')) return 'major'
    if (labels.includes('release:minor')) return 'minor'
    return 'patch'
}

/** The level that leads from `base` to `version`, or null when it is no single bump. */
function levelBetween(base: string, version: string): Level | null {
    return LEVELS.find((level) => bump(base, level) === version) ?? null
}

/**
 * The entries `versions.json` must hold: unchanged scripts keep main's entry, changed ones get one
 * bump of main's version. `level` 'keep' (the commit hook) keeps a bump the branch already carries
 * (e.g. one made with `--level minor`) and bumps by patch otherwise.
 */
export function expectedVersions(input: {
    base: Versions
    current: Versions
    hashes: Record<string, string>
    level: Level | 'keep'
}): Versions {
    const { base, current, hashes, level } = input
    const expected: Versions = {}
    for (const [name, sha256] of Object.entries(hashes)) {
        const onMain = base[name]
        if (!onMain) {
            expected[name] = { version: INITIAL_VERSION, sha256 }
        } else if (onMain.sha256 === sha256) {
            expected[name] = onMain
        } else {
            const carried = current[name] && levelBetween(onMain.version, current[name].version)
            const target = level === 'keep' ? (carried ?? 'patch') : level
            expected[name] = { version: bump(onMain.version, target), sha256 }
        }
    }
    return expected
}

/** Differences between what `versions.json` holds and what it must hold, one line per script. */
export function versionProblems(current: Versions, expected: Versions): string[] {
    const problems: string[] = []
    for (const [name, want] of Object.entries(expected)) {
        const have = current[name]
        if (!have) problems.push(`${name}: missing, expected ${want.version}`)
        else if (have.version !== want.version) problems.push(`${name}: version ${have.version}, expected ${want.version}`)
        else if (have.sha256 !== want.sha256) problems.push(`${name}: recorded hash does not match the built bundle`)
    }
    for (const name of Object.keys(current)) {
        if (!expected[name]) problems.push(`${name}: recorded but not in the registry`)
    }
    return problems
}
