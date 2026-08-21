'use client';

import { useState } from 'react';
import type { AppConfig, Coupon } from '@/lib/types';
import CouponDetail from './coupon/CouponDetail';
import CouponTicket from './coupon/CouponTicket';
import { TicketIcon } from './icons';

interface CouponsViewProps {
  config: AppConfig;
}

const SEGMENTS = ['Todos', 'Pingo Doce', 'Parceiros'] as const;

/**
 * View B — Coupons list + detail.
 * Green perforated ticket cards; tapping "Ver código" opens the coupon detail
 * with its own scannable barcode, discount value and terms.
 */
export default function CouponsView({ config }: CouponsViewProps) {
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Todos');

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
        <h2 className="text-lg font-bold text-ink">Cupões Pingo Doce</h2>

        {config.coupons.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <TicketIcon className="h-12 w-12 text-ink-faint" />
            <p className="text-sm text-ink-soft">
              Sem cupões ativos. Adicione cupões no ecrã de configuração.
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
    </div>
  );
}
