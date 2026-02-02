export interface GmFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export function gmFetch(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<GmFetchResponse> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: options.method || 'GET',
      url,
      headers: options.headers || {},
      data: options.body,
      responseType: 'json',
      onload(response) {
        if (response.status >= 200 && response.status < 300) {
          resolve({
            ok: true,
            status: response.status,
            json: () => Promise.resolve(response.response),
          });
        } else {
          reject(new Error(`HTTP ${response.status}`));
        }
      },
      onerror() {
        reject(new Error('Network error'));
      },
      ontimeout() {
        reject(new Error('Request timeout'));
      },
    });
  });
}
