export const Config = {
  business: {
    DISCOUNT_FACTOR: 0.97,
    MAX_MULTI_ORDER_LIMIT: 20,
    MAX_MERGED_ORDERS: 50,
  },
  timing: {
    DEBOUNCE_DELAY: 120,
    URL_CLEANUP_DELAY: 10000,
    RETRY_DELAY_BASE: 1000,
    STATUS_SUCCESS_REMOVE_DELAY: 5000,
  },
  download: {
    MAX_RETRY_ATTEMPTS: 5,
    MAX_CONCURRENT_DOWNLOADS: 2,
    MAX_RETRY_FULL: 3,
    MAX_RETRY_TOTAL: 6,
  },
  ui: {
    LOADING_TEXT: 'Exportiere...',
  },
} as const;
