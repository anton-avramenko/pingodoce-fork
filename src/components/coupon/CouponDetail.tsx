'use client';

import { useState } from 'react';
import type { Coupon } from '@/lib/types';
import Barcode from '../Barcode';
import { CloseIcon, CopyIcon } from '../icons';
import PromoArt from './PromoArt';
import { formatRange, isExpired } from './utils';

/**
 * Coupon detail bottom-sheet replicating the app's coupon screen: green promo
 * banner, title, validity range, a scannable barcode card with a copyable
 * number, and a "Condições" (terms) section.
 */
export default function CouponDetail({
  coupon,
  onClose,
}: {
  coupon: Coupon;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const expired = isExpired(coupon.expiresAt);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.barcode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may be unavailable; ignore in the POC
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/45"
      />

      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col animate-sheet-up rounded-t-3xl bg-white shadow-sheet"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-surface-line" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhe do cupão"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-soft shadow-sm"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="overflow-y-auto px-5 pt-3">
          {/* Green promo banner */}
          <PromoArt coupon={coupon} size="lg" className="h-44 w-full rounded-2xl" />

          <h2 className="mt-4 text-[22px] font-extrabold leading-tight text-ink">{coupon.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{formatRange(coupon.startsAt, coupon.expiresAt)}</p>

          {/* Barcode card */}
          <div className="mt-4 rounded-2xl border border-surface-line bg-white p-4 shadow-card">
            <Barcode value={coupon.barcode} format={coupon.format} height={92} barWidth={2} />
            <button
              type="button"
              onClick={copy}
              className="mx-auto mt-3 flex items-center gap-2 text-ink active:opacity-70"
            >
              <span className="font-mono text-lg tracking-[0.12em]">{coupon.barcode}</span>
              <CopyIcon className={`h-4 w-4 ${copied ? 'text-brand' : 'text-brand-mid'}`} />
            </button>
            {copied && <p className="mt-1 text-center text-[11px] font-semibold text-brand">Copiado ✓</p>}

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-tint px-3 py-2.5">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
              <p className="text-[13px] font-medium text-brand-dark">
                {expired
                  ? 'Este cupão expirou.'
                  : 'Consulte abaixo as condições para rebater este cupão.'}
              </p>
            </div>
          </div>

          {/* Conditions */}
          <h3 className="mt-6 text-xl font-extrabold text-ink">Condições</h3>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">
            {coupon.conditions?.trim() ||
              'Cupão válido numa única utilização, mediante apresentação do código na caixa. Não acumulável com outras campanhas.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" />
      <path d="M12 10.5v5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="1.15" fill="#fff" />
    </svg>
  );
}
