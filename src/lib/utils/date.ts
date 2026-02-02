const GERMAN_MONTHS: Record<string, string> = {
  'Januar': '01', 'Februar': '02', 'März': '03', 'Maerz': '03',
  'April': '04', 'Mai': '05', 'Juni': '06', 'Juli': '07',
  'August': '08', 'September': '09', 'Oktober': '10', 'Okt.': '10',
  'November': '11', 'Dezember': '12', 'Dez.': '12',
};

export function formatGermanDate(input: string | Date | null | undefined): string {
  if (!input) return '';
  const stringInput = String(input).trim();
  const numericMatch = stringInput.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (numericMatch) {
    const day = numericMatch[1].padStart(2, '0');
    const month = numericMatch[2].padStart(2, '0');
    const year = numericMatch[3];
    return `${day}.${month}.${year}`;
  }
  const textMatch = stringInput.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ.]+)\s+(\d{4})$/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthCode = GERMAN_MONTHS[textMatch[2]] || '';
    const year = textMatch[3];
    if (monthCode) return `${day}.${monthCode}.${year}`;
  }
  return '';
}

export function formatDateFromISO(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function formatTodayGerman(): string {
  return formatDateFromISO(new Date().toISOString());
}
