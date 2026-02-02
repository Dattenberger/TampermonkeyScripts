export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return `order-${Date.now()}.csv`;
  return String(filename).trim().replace(/[\\/:*?"<>|]+/g, '_') + '.csv';
}
