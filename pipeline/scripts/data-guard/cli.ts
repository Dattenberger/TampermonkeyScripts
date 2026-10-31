// `npm run data-guard` — scans every file under src/ and dist/ (fixtures included) with the public
// data guard (rules.ts) and fails on any finding. Runs in CI on every pull request and on main.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanText } from './rules.js'

const PIPELINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOTS = ['src', 'dist']

const files = ROOTS.flatMap((root) =>
    readdirSync(path.join(PIPELINE, root), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(PIPELINE, path.join(entry.parentPath, entry.name))),
)
const findings = files.flatMap((file) => scanText(file, readFileSync(path.join(PIPELINE, file), 'utf8')))

for (const { file, line, rule, match } of findings) console.error(`${file}:${line}: ${rule}: ${match}`)
console.log(`data guard: ${files.length} files, ${findings.length} findings`)
process.exitCode = findings.length > 0 ? 1 : 0
