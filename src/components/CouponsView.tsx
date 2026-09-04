'use client';

import { useState } from 'react';
import { resolveAiSettings } from '@/lib/scan';
import type { AppConfig, Coupon } from '@/lib/types';
import CouponDetail from './coupon/CouponDetail';
import CouponTicket from './coupon/CouponTicket';
import { CameraIcon, TicketIcon } from './icons';
import CodeScanner, { type PickedCode } from './scan/CodeScanner';

interface CouponsViewProps {
  config: AppConfig;
  /** Persist a coupon created from a scanned photo. */
  onAddCoupon: (coupon: Coupon) => void;
  onOpenSetup: () => void;
}

/** Default validity for a scanned coupon whose expiry wasn't readable. */
const DEFAULT_VALIDITY_DAYS = 30;

function couponFromScan({ candidate, result }: PickedCode): Coupon {
  const today = new Date();
  const fallbackExpiry = new Date(today);
  fallbackExpiry.setDate(today.getDate() + DEFAULT_VALIDITY_DAYS);

  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `c-${Math.random().toString(36).slice(2)}`,
    title: result.title ?? 'Cupão digitalizado',
    discount: result.discount ?? '',
    barcode: candidate.code,
    format: candidate.format,
    startsAt: today.toISOString().slice(0, 10),
    expiresAt: result.expiresAt ?? fallbackExpiry.toISOString().slice(0, 10),
    conditions: '',
    kind: result.couponKind ?? 'store',
  };
}

const SEGMENTS = ['Todos', 'Pingo Doce', 'Parceiros'] as const;

/**
 * View B — Coupons list + detail.
 * Green perforated ticket cards; tapping "Ver código" opens the coupon detail
 * with its own scannable barcode, discount value and terms.
 */
export default function CouponsView({ config, onAddCoupon, onOpenSetup }: CouponsViewProps) {
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Todos');
  const [scanning, setScanning] = useState(false);

  const handleScanned = (picked: PickedCode) => {
    const coupon = couponFromScan(picked);
    onAddCoupon(coupon);
    setScanning(false);
    setSelected(coupon);
  };

  return (
    <div className="min-h-full bg-surface-muted">
      <h1 className="pt-4 text-center text-lg font-bold text-ink">Cupões</h1>

      {/* Segmented control */}
      <div className="mx-auto mt-3 max-w-md px-4">
        <div className="flex rounded-full border border-surface-line bg-white p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegment(s)}
              className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
                segment === s ? 'bg-ink text-white' : 'text-ink-soft'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pb-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Cupões Pingo Doce</h2>
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-[13px] font-bold text-brand-dark active:bg-brand-tintDark"
          >
            <CameraIcon className="h-4 w-4" />
            Digitalizar
          </button>
        </div>

        {config.coupons.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <TicketIcon className="h-12 w-12 text-ink-faint" />
            <p className="text-sm text-ink-soft">
              Sem cupões ativos. Digitalize um cupão com a câmara ou adicione-o no ecrã de
              configuração.
            </p>
          </div>
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

      {selected && <CouponDetail coupon={selected} onClose={() => setSelected(null)} />}

      {scanning && (
        <CodeScanner
          purpose="coupon"
          ai={resolveAiSettings(config)}
          onPick={handleScanned}
          onClose={() => setScanning(false)}
          onOpenSettings={() => {
            setScanning(false);
            onOpenSetup();
          }}
        />
      )}
    </div>
  );
}
