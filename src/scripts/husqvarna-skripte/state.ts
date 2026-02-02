export interface QueueItem {
  orderNumber: string;
  siteName: string;
  filename: string;
  $btn: JQuery;
  iconSelector: string;
  textSelector: string;
  originalIcon: string;
  originalText: string;
  retryAttempt: number;
  isCustomOrderInput?: boolean;
}

export const State = {
  orderCache: new Map<string, unknown>(),
  activeDownloads: new Set<string>(),
  downloadQueue: [] as QueueItem[],
  retryCounters: new Map<string, number>(),
  downloadStatusItems: new Map<string, HTMLElement>(),
};
