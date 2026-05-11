// Layout registry — ordered list, first match wins.
//
//   iframeLayout   claims items containing <iframe srcdoc>
//   inlineLayout   catch-all fallback for everything else
//
// Adding a new layout: import here and insert at the position that reflects
// its match specificity. Catch-all handlers must stay last.

import { iframeLayout } from './iframe.js'
import { inlineLayout } from './inline.js'
import type { LayoutHandler } from './types.js'

export const layouts: readonly LayoutHandler[] = [iframeLayout, inlineLayout]
export type { LayoutHandler } from './types.js'
