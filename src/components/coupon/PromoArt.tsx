'use client';

import type { Coupon } from '@/lib/types';

/**
 * Green coupon promo artwork: a cream disc on a bright green field with the
 * "GANHOU {discount} EM …" text, matching the reference app's coupons.
 */
export default function PromoArt({
  coupon,
  size = 'sm',
  className,
}: {
  coupon: Coupon;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const subtitle = coupon.kind === 'fuel' ? 'em combustível' : 'em saldo';
  const t =
    size === 'lg'
      ? { ganhou: 'text-base', value: 'text-[52px]', sub: 'text-[13px]', mark: 'h-6 w-6' }
      : { ganhou: 'text-[9px]', value: 'text-[26px]', sub: 'text-[8px]', mark: 'h-3.5 w-3.5' };

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-lime to-brand-card2 ${className ?? ''}`}
    >
      <div className="flex aspect-square w-[82%] max-w-[210px] flex-col items-center justify-center rounded-full bg-cream px-2 text-center leading-[0.95] text-brand-deep">
        <span className={`font-extrabold uppercase tracking-tight ${t.ganhou}`}>Ganhou</span>
        <span className={`font-black tracking-tight ${t.value}`}>{coupon.discount}</span>
        <span className={`font-extrabold uppercase tracking-tight ${t.sub}`}>{subtitle}</span>
        {coupon.kind === 'fuel' && <Sunburst className={`mt-1 ${t.mark}`} />}
      </div>
    </div>
  );
}

/** Small generic fuel-brand sunburst (green centre, amber rays). */
function Sunburst({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {rays.map((deg) => (
        <rect
          key={deg}
          x="11.2"
          y="1.5"
          width="1.6"
          height="6"
          rx="0.8"
          fill="#F5C400"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="5.5" fill="#009E4F" />
      <circle cx="12" cy="12" r="2.4" fill="#F5C400" />
    </svg>
  );
}
