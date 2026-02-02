export function nullSafeString(value: unknown): string {
  return value == null ? '' : String(value);
}

export function nullSafeMatch(inputString: string | null | undefined, regex: RegExp, groupIndex: number = 1): string {
  if (!inputString) return '';
  const match = String(inputString).match(regex);
  return (match && match.length > groupIndex) ? match[groupIndex] : '';
}
