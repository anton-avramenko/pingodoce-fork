/** Barcode symbologies supported by the POC (subset of JsBarcode formats). */
export type BarcodeFormat = 'CODE128' | 'EAN13' | 'CODE39' | 'ITF';

/** Coupon categories — the fuel coupon has a dedicated visual treatment. */
export type CouponKind = 'fuel' | 'store';

export interface Coupon {
  id: string;
  /** Short title shown in the list, e.g. "Desconto Combustível". */
  title: string;
  /** Human-readable discount amount, e.g. "10€" or "0,06€/L". */
  discount: string;
  /** Raw value encoded into the coupon barcode. */
  barcode: string;
  /** Barcode symbology used to render this coupon. */
  format: BarcodeFormat;
  /** Optional start of validity in ISO format (yyyy-mm-dd). */
  startsAt?: string;
  /** Expiration date in ISO format (yyyy-mm-dd). */
  expiresAt: string;
  /** Terms shown in the detail's "Condições" section. */
  conditions?: string;
  kind: CouponKind;
}

/** Full app configuration persisted in localStorage. */
export interface AppConfig {
  /** Value encoded into the main digital card barcode ("O Meu Pingo Doce"). */
  cardNumber: string;
  /** Secondary loyalty number shown on the card ("Poupa Mais"). */
  poupaMaisNumber: string;
  /** Symbology of the main card barcode. */
  cardFormat: BarcodeFormat;
  /** User identifier placeholder (first name) shown across the app. */
  userName: string;
  coupons: Coupon[];
}

export const BARCODE_FORMATS: BarcodeFormat[] = [
  'EAN13',
  'CODE128',
  'CODE39',
  'ITF',
];
