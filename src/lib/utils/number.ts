export function parseEuropeanNumber(input: string | number | null | undefined): number {
  if (!input) return NaN;
  const cleanedNumber = parseFloat(String(input).trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(cleanedNumber) ? cleanedNumber : NaN;
}
