// Inline ChatView layout — Greyhound renders mail bodies directly into the
// page DOM, no iframe. Catch-all fallback: anything that isn't claimed by
// the iframe layout lands here. See ../inline/setup.ts for the
// self-healing mechanics that compensate for React re-renders.

import { setupInline } from '../inline/setup.js'
import type { LayoutHandler } from './types.js'

export const inlineLayout: LayoutHandler = {
    name: 'inline-chatview',
    matches: () => true,
    setup: (itemEl, direction) => {
        setupInline(itemEl as HTMLElement, direction)
    },
}
