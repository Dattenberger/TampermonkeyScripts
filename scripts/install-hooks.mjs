// Activates the local Git hooks under `scripts/hooks/` by pointing
// `core.hooksPath` at that directory and making the hook executable.
//
// Run automatically by the `prepare` lifecycle script after `npm install`.
// Mirrors the mechanic used in the JTL-Zentralisierungs-Repo — keeps the
// repo Husky-free.

import { execSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const hookPath = resolve(repoRoot, 'scripts/hooks/pre-commit')

// CI envs (GitHub Actions etc.) typically don't have a .git dir or don't
// want hooks installed. Detect and bail out silently.
if (process.env.CI === 'true' || !existsSync(resolve(repoRoot, '.git'))) {
    process.exit(0)
}

try {
    execSync('git config core.hooksPath scripts/hooks', { cwd: repoRoot, stdio: 'pipe' })
    if (existsSync(hookPath)) {
        chmodSync(hookPath, 0o755)
    }
    console.log('Git hooks activated (core.hooksPath = scripts/hooks).')
} catch (error) {
    console.warn('Could not activate git hooks:', error instanceof Error ? error.message : error)
}
