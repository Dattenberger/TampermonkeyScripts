// Iterate over `scripts.config.ts` and build each registered userscript
// via `vite build`. Pass a script-name as the only argument to build a
// single script (e.g. `tsx build.ts husqvarna-skripte`).

import { execSync } from 'node:child_process'
import { scripts } from './scripts.config.js'

const filter = process.argv[2]
const entries = Object.entries(scripts)

if (entries.length === 0) {
    console.log('No scripts registered in scripts.config.ts — nothing to build.')
    process.exit(0)
}

if (filter && !scripts[filter]) {
    const known = Object.keys(scripts).join(', ')
    console.error(`Unknown script: "${filter}". Registered: ${known}`)
    process.exit(1)
}

let built = 0
for (const [name] of entries) {
    if (filter && name !== filter) continue
    console.log(`\nBuilding ${name}...`)
    execSync(`cross-env SCRIPT=${name} vite build`, { stdio: 'inherit' })
    built++
}

console.log(`\nBuilt ${built} script(s).`)
