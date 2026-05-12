// Activates the local Git hooks under `pipeline/scripts/hooks/` by
// pointing `core.hooksPath` at that directory and making the hook
// executable.
//
// Run automatically by the `prepare` lifecycle script after
// `npm install` (which runs from `pipeline/`). Mirrors the mechanic
// used in the JTL-Zentralisierungs-Repo — keeps the repo Husky-free.

import { execSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// __dirname        → pipeline/scripts
// pipelineRoot     → pipeline/
// repoRoot         → git repo root (one level above pipeline/, contains .git)
const pipelineRoot = resolve(__dirname, '..')
const repoRoot = resolve(pipelineRoot, '..')
const hookPath = resolve(pipelineRoot, 'scripts/hooks/pre-commit')

// CI envs (GitHub Actions etc.) typically don't have a .git dir or don't
// want hooks installed. Detect and bail out silently.
if (process.env.CI === 'true' || !existsSync(resolve(repoRoot, '.git'))) {
    process.exit(0)
}

try {
    // hooksPath is resolved by git against the worktree root, so it must
    // be specified relative to repo root — not relative to the cwd of
    // `git config`. We pass cwd=repoRoot for clarity.
    execSync('git config core.hooksPath pipeline/scripts/hooks', { cwd: repoRoot, stdio: 'pipe' })
    if (existsSync(hookPath)) {
        chmodSync(hookPath, 0o755)
    }
    console.log('Git hooks activated (core.hooksPath = pipeline/scripts/hooks).')
} catch (error) {
    console.warn('Could not activate git hooks:', error instanceof Error ? error.message : error)
}
