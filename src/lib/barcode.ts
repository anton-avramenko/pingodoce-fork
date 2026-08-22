import type { BarcodeFormat } from './types';

/** Computes the EAN-13 check digit for the first 12 digits. */
function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** True when `value` is a syntactically valid EAN-13 (13 digits + check digit). */
export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  return ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/**
 * Picks the symbology to actually render with.
 *
 * Pingo Doce / Poupa Mais / BP codes are EAN-13. Older saved configs (and the
 * previous demo data) defaulted to CODE128, which encodes the same digits but
 * looks different and may not scan the same way. So when a value is a valid
 * EAN-13 we render EAN-13 unless the user explicitly chose another symbology.
 */
export function effectiveFormat(value: string, format: BarcodeFormat): BarcodeFormat {
  if (format === 'CODE128' && isValidEan13(value)) return 'EAN13';
  return format;
}
