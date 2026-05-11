// Public surface of @lib/utils — re-export only what other modules are
// allowed to consume. The `index-boundary` ESLint rule enforces that
// outside code goes through this barrel.

export { nonEmpty, truncate } from './string.js'
