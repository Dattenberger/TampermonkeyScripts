// Hard rules for the GitHub workflows of this public repository: a workflow that runs with
// secrets or with write access could be turned against the repository by a pull request.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WORKFLOWS = path.resolve(import.meta.dirname, '../../../.github/workflows')
const files = readdirSync(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file))
/** A workflow without its comment lines, which may name what is forbidden. */
const read = (file: string) => readFileSync(path.join(WORKFLOWS, file), 'utf8').replaceAll(/^\s*#.*\n/gm, '')

/** The top-level `on:` block, up to the next top-level key. */
function triggers(workflow: string): string {
    return /^on:\n((?:[ #].*\n|\n)*)/m.exec(workflow)?.[1] ?? ''
}

describe('workflows', () => {
    it('exist', () => {
        expect(files).toContain('ci.yml')
    })

    it.each(files)('%s uses no secret and no pull_request_target', (file) => {
        const workflow = read(file)
        expect(workflow).not.toMatch(/pull_request_target/)
        expect(workflow).not.toMatch(/\bsecrets\s*[.[]/)
    })

    it.each(files)('%s runs with a read-only token', (file) => {
        const workflow = read(file)
        expect(workflow).toMatch(/^permissions:\n {2}contents: read\n(?! )/m)
        expect(workflow).not.toMatch(/: *write\b|write-all/)
    })

    it.each(files)('%s runs on pull requests into main, pushes to main and by hand only', (file) => {
        const on = triggers(read(file))
        const events = [...on.matchAll(/^ {2}(\w+):/gm)].map(([, event]) => event)
        expect(events).toEqual(['pull_request', 'push', 'workflow_dispatch'])
        expect(on).toMatch(/^ {2}pull_request:\n {4}branches: \[main\]\n/m)
        expect(on).toMatch(/^ {2}push:\n {4}branches: \[main\]\n/m)
    })

    it('the rules catch what they forbid', () => {
        expect('on:\n  pull_request_target:\n').toMatch(/pull_request_target/)
        expect('token: ${{ secrets.ANY }}').toMatch(/\bsecrets\s*[.[]/)
        expect('    contents: write').toMatch(/: *write\b/)
        expect(triggers('on:\n  push:\n    branches:\n      - "**"\n\njobs:\n')).toBe('  push:\n    branches:\n      - "**"\n\n')
    })
})
