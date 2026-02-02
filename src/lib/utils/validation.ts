export function validateOrderNumber(orderNumber: string | number | null | undefined): boolean {
  return /^\d{6,}$/.test(String(orderNumber || ''));
}

export interface ParsedOrderNumbers {
  valid: string[];
  invalid: string[];
}

export function parseOrderNumbers(input: string | null | undefined): ParsedOrderNumbers {
  if (!input || typeof input !== 'string') {
    return { valid: [], invalid: [] };
  }
  const parts = input.trim().split(/[,\s;]+/).filter(part => part.length > 0);
  const valid: string[] = [];
  const invalid: string[] = [];
  parts.forEach(part => {
    const trimmed = part.trim();
    if (validateOrderNumber(trimmed)) {
      valid.push(trimmed);
    } else if (trimmed.length > 0) {
      invalid.push(trimmed);
    }
  });
  return { valid, invalid };
}
