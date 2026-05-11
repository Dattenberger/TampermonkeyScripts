// Type declarations for Tampermonkey GM_* APIs.
// Extend as needed when scripts start using more grants.

declare function GM_addStyle(css: string): HTMLStyleElement

interface GmXmlHttpRequestResponse {
    status: number
    statusText: string
    response: unknown
    responseText: string
    responseHeaders: string
    finalUrl?: string
}

interface GmXmlHttpRequestDetails {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
    url: string
    headers?: Record<string, string>
    data?: string | FormData | Blob
    binary?: boolean
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text' | 'document'
    timeout?: number
    onload?: (response: GmXmlHttpRequestResponse) => void
    onerror?: (response: GmXmlHttpRequestResponse) => void
    ontimeout?: () => void
    onprogress?: (response: GmXmlHttpRequestResponse & { loaded: number; total: number }) => void
}

declare function GM_xmlhttpRequest(details: GmXmlHttpRequestDetails): { abort: () => void }

declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_deleteValue(key: string): void
declare function GM_listValues(): string[]

declare function GM_openInTab(
    url: string,
    options?: { active?: boolean; insert?: boolean; setParent?: boolean; loadInBackground?: boolean },
): { close: () => void; closed: boolean }

declare function GM_setClipboard(data: string, info?: string | { type: string; mimetype: string }): void

declare function GM_notification(
    details:
        | string
        | {
              text: string
              title?: string
              image?: string
              timeout?: number
              onclick?: () => void
              ondone?: () => void
          },
    ondone?: () => void,
): void

declare const unsafeWindow: Window & typeof globalThis
