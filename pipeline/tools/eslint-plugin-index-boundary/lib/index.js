// Plugin aggregator — `eslint-plugin-index-boundary`.
//
// Project-Local-Plugin (not published). Exposes a single rule:
// `enforce-boundary`. See README.md for activation snippet.

import { enforceBoundary } from './rules/enforce-boundary.js'

const meta = {
    name: 'eslint-plugin-index-boundary',
    version: '0.1.0',
}

const rules = {
    'enforce-boundary': enforceBoundary,
}

const plugin = { meta, rules }

export default plugin
export { meta, rules, enforceBoundary }
