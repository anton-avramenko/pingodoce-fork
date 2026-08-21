'use client';

import { useState } from 'react';
import type { AppConfig, Coupon } from '@/lib/types';
import Barcode from './Barcode';
import CouponDetail from './coupon/CouponDetail';
import CouponTicket from './coupon/CouponTicket';
import { CloseIcon, CopyIcon, TicketIcon } from './icons';
import { OMeuWordmark, PoupaMaisWordmark } from './Wordmark';

interface CardViewProps {
  config: AppConfig;
  /** Present as a full-screen overlay (matches the app's "O seu cartão"). */
  onClose?: () => void;
}

/**
 * View A — Digital Card ("O seu cartão").
 *
 * Bright green wavy loyalty card with a high-contrast barcode, the two loyalty
 * numbers with copy buttons and an active-coupons pill, followed by the
 * "Mais N cupões disponíveis" sheet — the layout the app shows when the card
 * is presented at the till.
 */
export default function CardView({ config, onClose }: CardViewProps) {
  const [selected, setSelected] = useState<Coupon | null>(null);
  const activeCount = config.coupons.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <header
        className="relative flex shrink-0 items-center justify-center bg-brand-tint px-4 py-3.5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute left-4 flex h-9 w-9 items-center justify-center text-ink"
            style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold text-ink">O seu cartão</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Green section with the card */}
        <div className="bg-brand-tint px-4 pb-6">
          <div className="mx-auto w-full max-w-md">
            {/* The bright green card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-card1 via-brand-lime to-brand-card2 p-5 shadow-card">
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
                viewBox="0 0 400 240"
                preserveAspectRatio="none"
                aria-hidden
              >
                {[0, 30, 60, 90, 120].map((y) => (
                  <path
                    key={y}
                    d={`M-20 ${60 + y} C 80 ${20 + y}, 160 ${100 + y}, 260 ${60 + y} S 420 ${20 + y}, 440 ${70 + y}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>

              <div className="relative flex items-start justify-between">
                <OMeuWordmark />
                <PoupaMaisWordmark />
              </div>

              <div className="relative mt-5 rounded-xl bg-white px-4 py-4">
                <Barcode value={config.cardNumber} format={config.cardFormat} height={92} barWidth={2} />
              </div>
            </div>

            {/* Two loyalty numbers */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <NumberCard label="N.º Cartão Poupa Mais" value={config.poupaMaisNumber} />
              <NumberCard label="N.º O Meu Pingo Doce" value={config.cardNumber} />
            </div>

            {/* Active coupons pill */}
            <div className="mt-5 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-tintDark px-4 py-2 text-sm font-bold text-brand-dark">
                <TicketIcon className="h-4 w-4" />
                {activeCount} {activeCount === 1 ? 'cupão ativo' : 'cupões ativos'}
              </div>
            </div>
          </div>
        </div>

        {/* White sheet: more coupons (fills the lower area, like the app) */}
        <div className="min-h-[40vh] rounded-t-3xl bg-white pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-surface-line" />
          <div className="mx-auto max-w-md px-4 pb-10">
            {activeCount > 0 && (
              <p className="mt-3 text-center text-lg font-bold text-ink">
                Mais {activeCount} {activeCount === 1 ? 'cupão disponível' : 'cupões disponíveis'}
              </p>
            )}
            <h2 className="mt-4 text-lg font-bold text-ink">Cupões Pingo Doce</h2>

            {activeCount === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Sem cupões disponíveis de momento.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {config.coupons.map((coupon) => (
                  <li key={coupon.id}>
                    <CouponTicket coupon={coupon} onOpen={() => setSelected(coupon)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {selected && <CouponDetail coupon={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function NumberCard({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may be blocked; ignore silently in the POC
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex flex-col items-start gap-1 rounded-2xl bg-white p-3 text-left shadow-card active:bg-surface-muted"
    >
      <span className="text-[11px] font-semibold text-ink-soft">{label}</span>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-mono text-[15px] tracking-wide text-ink">{value || '—'}</span>
        <CopyIcon className={`h-4 w-4 shrink-0 ${copied ? 'text-brand' : 'text-brand-mid'}`} />
      </span>
      {copied && <span className="text-[10px] font-semibold text-brand">Copiado ✓</span>}
    </button>
  );
}
