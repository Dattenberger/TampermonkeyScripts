// Hard rules for the GitHub workflows of this public repository: a workflow that runs with
// secrets or with write access could be turned against the repository by a pull request.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const WORKFLOWS = path.resolve(import.meta.dirname, '../../../.github/workflows')
const files = readdirSync(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file))

interface Workflow {
    on: Record<string, { branches?: string[] } | null>
    permissions?: unknown
    jobs: Record<string, { permissions?: unknown }>
}

const source = (file: string) => readFileSync(path.join(WORKFLOWS, file), 'utf8')
const workflow = (file: string) => parse(source(file)) as Workflow
/** Every expression and value of the workflow, without its comments (which may name what is forbidden). */
const code = (file: string) => JSON.stringify(parse(source(file)))

describe('workflows', () => {
    it('exist', () => {
        expect(files).toContain('ci.yml')
    })

    it.each(files)('%s uses no secret and no pull_request_target', (file) => {
        expect(Object.keys(workflow(file).on)).not.toContain('pull_request_target')
        expect(code(file)).not.toMatch(/\bsecrets\s*[.[]/)
    })

    it.each(files)('%s runs with a read-only token', (file) => {
        const { permissions, jobs } = workflow(file)
        expect(permissions).toEqual({ contents: 'read' })
        for (const job of Object.values(jobs)) expect(job.permissions).toBeUndefined()
    })

    it.each(files)('%s runs on pull requests into main, pushes to main and by hand only', (file) => {
        const { on } = workflow(file)
        expect(Object.keys(on).toSorted()).toEqual(['pull_request', 'push', 'workflow_dispatch'])
        expect(on.pull_request?.branches).toEqual(['main'])
        expect(on.push?.branches).toEqual(['main'])
    })

    it('the secret rule catches an expression', () => {
        expect(JSON.stringify(parse('env:\n  T: ${{ secrets.ANY }}\n  U: ${{ secrets[\'X\'] }}\n'))).toMatch(/\bsecrets\s*[.[]/)
    })
})
