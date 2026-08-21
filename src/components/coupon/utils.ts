/** Date helpers shared across coupon components. */

const PT_MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/** dd/mm/yyyy */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "23 Ago." */
export function formatDayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${PT_MONTHS[m - 1]}.`;
}

/** "19 Ago. a 23 Ago." when a start date exists, else "Válido até 23/08/2026". */
export function formatRange(startsAt: string | undefined, expiresAt: string): string {
  if (startsAt) return `${formatDayMonth(startsAt)} a ${formatDayMonth(expiresAt)}`;
  return `Válido até ${formatDate(expiresAt)}`;
}

export function isExpired(iso: string): boolean {
  const expiry = new Date(`${iso}T23:59:59`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
}
