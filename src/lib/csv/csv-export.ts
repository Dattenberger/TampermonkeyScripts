export function generateCsv(data: object[], separator: string = ';'): string {
  return $.csv.fromObjects(data as Record<string, unknown>[], { separator });
}

export function downloadCsvBlob(csvContent: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
