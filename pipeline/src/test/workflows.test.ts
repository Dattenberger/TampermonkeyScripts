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
/** Every string of the parsed workflow (keys and values), without its comments, which may name
 *  what is forbidden; line breaks inside a value stay as they are. */
function strings(node: unknown): string[] {
    if (typeof node === 'string') return [node]
    if (Array.isArray(node)) return node.flatMap((item) => strings(item))
    if (node && typeof node === 'object') return Object.entries(node).flatMap(([key, value]) => [key, ...strings(value)])
    return []
}
const SECRET = /\bsecrets\s*[.[]/
const usesSecret = (yaml: string) => strings(parse(yaml)).some((text) => SECRET.test(text))

describe('workflows', () => {
    it('exist', () => {
        expect(files).toContain('ci.yml')
    })

    it.each(files)('%s uses no secret and no pull_request_target', (file) => {
        expect(Object.keys(workflow(file).on)).not.toContain('pull_request_target')
        expect(usesSecret(source(file))).toBe(false)
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

    it('the secret rule catches an expression, also one split over lines', () => {
        expect(usesSecret('env:\n  T: ${{ secrets.ANY }}\n')).toBe(true)
        expect(usesSecret("steps:\n  - with:\n      t: ${{ secrets['X'] }}\n")).toBe(true)
        expect(usesSecret('env:\n  T: |\n    ${{ secrets\n      .ANY }}\n')).toBe(true)
        expect(usesSecret('# no secrets.ANY here\nenv:\n  T: plain\n')).toBe(false)
    })
})
