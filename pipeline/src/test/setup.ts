// Vitest test setup. Mocks the Tampermonkey GM_* API surface used by
// shared library code so unit tests can run in jsdom without flagging
// every `GM_*` call as `undefined`.
//
// Extend as the shared lib grows. Keep the mocks behavioural-equivalent
// where it matters (e.g. GM_getValue/GM_setValue back onto a Map).

import { vi, beforeEach } from 'vitest'

// GM storage — Map-backed so tests can read what they wrote.
const gmStorage = new Map<string, unknown>()

;(globalThis as Record<string, unknown>).GM_addStyle = vi.fn()
;(globalThis as Record<string, unknown>).GM_xmlhttpRequest = vi.fn()
;(globalThis as Record<string, unknown>).GM_openInTab = vi.fn(() => ({ close: vi.fn(), closed: false }))
;(globalThis as Record<string, unknown>).GM_setClipboard = vi.fn()
;(globalThis as Record<string, unknown>).GM_notification = vi.fn()

;(globalThis as Record<string, unknown>).GM_getValue = vi.fn((key: string, def?: unknown) =>
    gmStorage.has(key) ? gmStorage.get(key) : def,
)
;(globalThis as Record<string, unknown>).GM_setValue = vi.fn((key: string, value: unknown) => {
    gmStorage.set(key, value)
})
;(globalThis as Record<string, unknown>).GM_deleteValue = vi.fn((key: string) => {
    gmStorage.delete(key)
})
;(globalThis as Record<string, unknown>).GM_listValues = vi.fn(() => [...gmStorage.keys()])

beforeEach(() => {
    gmStorage.clear()
})
