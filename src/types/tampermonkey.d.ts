// Type declarations for Tampermonkey GM_* APIs and externals

declare function GM_addStyle(css: string): HTMLStyleElement;

declare function GM_xmlhttpRequest(details: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string;
  responseType?: string;
  onload?: (response: {
    status: number;
    statusText: string;
    response: unknown;
    responseText: string;
    responseHeaders: string;
  }) => void;
  onerror?: (error: unknown) => void;
  ontimeout?: () => void;
}): void;

// jQuery CSV plugin
interface JQueryStatic {
  csv: {
    fromObjects(data: Record<string, unknown>[], options?: { separator?: string }): string;
    fromArrays(data: unknown[][], options?: { separator?: string }): string;
    toObjects(csv: string, options?: { separator?: string }): Record<string, unknown>[];
    toArrays(csv: string, options?: { separator?: string }): unknown[][];
  };
}
