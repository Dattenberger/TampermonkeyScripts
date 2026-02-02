import { vi, beforeEach } from 'vitest';

// GM_* API mocks
(globalThis as any).GM_xmlhttpRequest = vi.fn();
(globalThis as any).GM_addStyle = vi.fn();

// GM storage mocks
const gmStorage = new Map<string, unknown>();
(globalThis as any).GM_getValue = vi.fn((key: string, def?: unknown) =>
  gmStorage.has(key) ? gmStorage.get(key) : def,
);
(globalThis as any).GM_setValue = vi.fn((key: string, val: unknown) => {
  gmStorage.set(key, val);
});
(globalThis as any).GM_deleteValue = vi.fn((key: string) => {
  gmStorage.delete(key);
});

beforeEach(() => {
  gmStorage.clear();
});

// jQuery mock — chainable methods
const createJQueryObj = () => {
  const obj: any = {
    find: vi.fn(() => obj),
    addClass: vi.fn(() => obj),
    removeClass: vi.fn(() => obj),
    attr: vi.fn(() => obj),
    removeAttr: vi.fn(() => obj),
    hasClass: vi.fn(() => false),
    html: vi.fn(() => obj),
    text: vi.fn(() => obj),
    css: vi.fn(() => obj),
    append: vi.fn(() => obj),
    on: vi.fn(() => obj),
    length: 1,
  };
  return obj;
};

const jQueryMock: any = Object.assign(
  vi.fn(() => createJQueryObj()),
  {
    csv: {
      fromObjects: vi.fn((data: any[], opts?: { separator?: string }) => {
        if (!data || !data.length) return '';
        const sep = opts?.separator || ';';
        const headers = Object.keys(data[0]);
        return [
          headers.join(sep),
          ...data.map(row => headers.map(h => String(row[h] ?? '')).join(sep)),
        ].join('\n');
      }),
    },
  },
);

(globalThis as any).$ = jQueryMock;
(globalThis as any).jQuery = jQueryMock;
