// `npm run version:update` / `npm run version:check` — builds every registered script and keeps
// `versions.json` and `dist/` in line with main (rules: versions.ts).
//
//   update [--level patch|minor|major] [--base <rev>]   writes versions.json, rebuilds bumped scripts,
//                                                       removes bundles no script owns (commit hook)
//   check  [--labels <a,b>|--level …] [--base <rev>]    fails unless versions.json and dist/ are what
//                                                       update would write (CI)
//
// The base is main as the branch will meet it: the merge-base with origin/main by default, the
// first parent of the merge commit in a PR's CI. A base without versions.json (main before the
// change that introduces it) takes the file as that change first committed it: the seed.

import { execFileSync, execSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { scripts } from '../../scripts.config.js'
import { contentHash, expectedVersions, levelFromLabels, versionProblems, type Level, type Versions } from './versions.js'

const PIPELINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const VERSIONS_FILE = path.join(PIPELINE, 'versions.json')
const DIST = path.join(PIPELINE, 'dist')

function git(...args: string[]): string {
    return execFileSync('git', args, { cwd: PIPELINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function readVersions(): Versions {
    return JSON.parse(readFileSync(VERSIONS_FILE, 'utf8')) as Versions
}

function writeVersions(versions: Versions): void {
    const sorted = Object.fromEntries(Object.entries(versions).toSorted(([a], [b]) => a.localeCompare(b)))
    writeFileSync(VERSIONS_FILE, `${JSON.stringify(sorted, undefined, 4)}\n`)
}

function versionsAt(revision: string): Versions | undefined {
    try {
        return JSON.parse(git('show', `${revision}:pipeline/versions.json`)) as Versions
    } catch {
        return undefined
    }
}

function baseVersions(base: string): Versions {
    const onBase = versionsAt(base)
    if (onBase) return onBase
    const seed = git('log', '--diff-filter=A', '--format=%H', 'HEAD', '--', 'versions.json').split('\n').at(-1)
    console.log(`versions: ${base} has no pipeline/versions.json — the seed of ${seed || 'the working tree'} is the base`)
    return (seed && versionsAt(seed)) || readVersions()
}

function build(name?: string): void {
    execSync(name ? `tsx build.ts ${name}` : 'tsx build.ts', { cwd: PIPELINE, stdio: 'inherit' })
}

function bundleHashes(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(scripts).map(([name, config]) => [
            name,
            contentHash(readFileSync(path.join(DIST, config.outputFileName), 'utf8')),
        ]),
    )
}

/** Files in dist/ that no registered script builds (renamed or removed scripts). */
function strayBundles(): string[] {
    const owned = new Set(Object.values(scripts).map((config) => config.outputFileName))
    return readdirSync(DIST).filter((file) => !owned.has(file))
}

function main(): number {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: { base: { type: 'string' }, level: { type: 'string' }, labels: { type: 'string' } },
    })
    const command = positionals[0]
    if (command !== 'update' && command !== 'check') throw new Error('usage: cli.ts update|check [--base <rev>] [--level <level>|--labels <a,b>]')
    const level = (values.labels === undefined ? (values.level ?? 'keep') : levelFromLabels(values.labels.split(','))) as Level | 'keep'
    if (!['patch', 'minor', 'major', 'keep'].includes(level)) throw new Error(`unknown level "${level}"`)

    const base = values.base ?? git('merge-base', 'HEAD', 'origin/main')
    build()
    const current = readVersions()
    const expected = expectedVersions({ base: baseVersions(base), current, hashes: bundleHashes(), level })

    if (command === 'update') {
        const bumped = Object.keys(expected).filter((name) => current[name]?.version !== expected[name]!.version)
        writeVersions(expected)
        for (const name of bumped) build(name)
        for (const file of strayBundles()) rmSync(path.join(DIST, file))
        for (const name of bumped) console.log(`versions: ${name} → ${expected[name]!.version}`)
        return 0
    }

    const problems = [
        ...versionProblems(current, expected),
        ...strayBundles().map((file) => `dist/${file}: no registered script builds it`),
    ]
    const drift = git('status', '--porcelain', '--', 'dist', 'versions.json')
    if (drift) problems.push(`dist/ or versions.json differ from what version:update writes:\n${drift}`)
    for (const problem of problems) console.error(`versions: ${problem}`)
    if (problems.length > 0) console.error('Fix: `npm run version:update` (add `--level minor|major` to match a release label), then commit.')
    return problems.length > 0 ? 1 : 0
}

process.exitCode = main()
