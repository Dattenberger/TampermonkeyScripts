// Test fixtures for the Greyhound Quote Collapser.
//
// Files are loaded synchronously at module-import time via fs.readFileSync.
// Vitest runs in Node, so this is fine — no Vite plugin tricks needed.
//
// FIXTURE STATUS:
//   ✅ OUTGOING_MULTI_QUOTE        — real sanitised Greyhound snippet
//   📝 INCOMING_URSPRUNGLICHE_DATEN — placeholder, awaiting real snippet
//   📝 INCOMING_ORIGINAL_MESSAGE   — placeholder, awaiting real snippet
//   📝 INCOMING_AM_SCHRIEB         — placeholder, awaiting real snippet
//   📝 INCOMING_BLOCKQUOTE_ONLY    — placeholder, awaiting real snippet
//   📝 OUTGOING_NO_FOOTER          — placeholder, awaiting real snippet
//   📝 WHITESPACE_NOISE            — placeholder, awaiting real snippet

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

function load(name: string): string {
    return readFileSync(path.join(here, '__fixtures__', name), 'utf8')
}

export const OUTGOING_MULTI_QUOTE = load('outgoing-multi-quote.html')
export const INCOMING_URSPRUNGLICHE_DATEN = load('incoming-ursprungliche-daten.html')
export const INCOMING_ORIGINAL_MESSAGE = load('incoming-original-message.html')
export const INCOMING_AM_SCHRIEB = load('incoming-am-schrieb.html')
export const INCOMING_BLOCKQUOTE_ONLY = load('incoming-blockquote-only.html')
export const OUTGOING_NO_FOOTER = load('outgoing-no-footer.html')
export const WHITESPACE_NOISE = load('whitespace-noise.html')
