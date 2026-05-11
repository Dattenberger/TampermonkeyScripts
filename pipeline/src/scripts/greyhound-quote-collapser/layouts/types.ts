import type { Direction } from '../types.js'

// A LayoutHandler claims items whose rendering shape it understands and
// wires up everything from style injection to body processing. The
// dispatcher in item-setup.ts walks the registry in order and hands off to
// the first match.
//
// Idempotency contract: setup() may be called more than once with the same
// itemEl; implementations must guard internally (typically via a WeakSet).
//
// Adding a new layout: create the handler module, append it to
// layouts/index.ts. The order in the registry is the matching priority.

export interface LayoutHandler {
    readonly name: string
    matches(itemEl: Element): boolean
    setup(itemEl: Element, direction: Direction): void
}
