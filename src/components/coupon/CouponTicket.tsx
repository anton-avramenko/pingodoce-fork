'use client';

import type { Coupon } from '@/lib/types';
import PromoArt from './PromoArt';
import { formatRange, isExpired } from './utils';

/**
 * Green perforated coupon ticket (list layout): promo art on the left, date
 * range + title + "Ver código" call-to-action on the right.
 */
export default function CouponTicket({
  coupon,
  onOpen,
}: {
  coupon: Coupon;
  onOpen: () => void;
}) {
  const expired = isExpired(coupon.expiresAt);

  return (
    <div className="flex overflow-hidden rounded-2xl bg-white shadow-card">
      <PromoArt coupon={coupon} className="w-[132px] shrink-0" />

      {/* Perforated divider */}
      <div className="relative w-0">
        <div className="absolute inset-y-2 left-0 border-l border-dashed border-surface-line" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-3.5">
        <p className="text-[12px] text-ink-soft">{formatRange(coupon.startsAt, coupon.expiresAt)}</p>
        <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
          {coupon.title}
        </p>
        <button
          type="button"
          onClick={onOpen}
          disabled={expired}
          className="mt-2.5 self-start rounded-lg bg-brand-mid px-5 py-2 text-[13px] font-bold text-white active:bg-brand-dark disabled:bg-ink-faint"
        >
          {expired ? 'Expirado' : 'Ver código'}
        </button>
      </div>
    </div>
  );
}
