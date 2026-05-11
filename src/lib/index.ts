// Top-level barrel for `@lib/*`. Each sub-module has its own `index.ts`
// barrel; consumers can either go through this aggregate or import the
// sub-module directly via its `@lib/<module>` alias.

export * as utils from './utils/index.js'
