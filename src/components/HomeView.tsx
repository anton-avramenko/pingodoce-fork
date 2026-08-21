'use client';

import { useState } from 'react';
import type { AppConfig, Coupon } from '@/lib/types';
import type { Tab } from './BottomNav';
import CouponDetail from './coupon/CouponDetail';
import PromoArt from './coupon/PromoArt';
import { PiggyIcon, StoreIcon, TagIcon } from './icons';

interface HomeViewProps {
  config: AppConfig;
  onNavigate: (tab: Tab) => void;
  onOpenCard: () => void;
}

/**
 * Início (Home) tab.
 * Loyalty balances, a "Campanhas" promo banner, an active-coupons carousel and
 * quick-action tiles, mirroring the app's home dashboard.
 */
export default function HomeView({ config, onNavigate, onOpenCard }: HomeViewProps) {
  const firstName = (config.userName || 'Cliente').split(' ')[0];
  const [selected, setSelected] = useState<Coupon | null>(null);

  return (
    <div className="min-h-full bg-surface-muted">
      <div className="mx-auto max-w-md px-4 pb-6 pt-3">
        <h1 className="text-[26px] font-extrabold text-ink">Olá, {firstName}!</h1>

        {/* Balance rows */}
        <div className="mt-4 space-y-3">
          <BalanceRow
            icon={<span className="text-[11px] font-black leading-none text-brand-dark">O<br />MEU</span>}
            label="Saldo Pingo Doce"
            pill="0,24€ disponíveis a 24 ago."
            value="0,00€"
            highlight
          />
          <BalanceRow
            icon={<PiggyIcon className="h-6 w-6 text-brand-dark" />}
            label="Já Poupei"
            sublabel="no último ano"
            value="20,14€"
          />
          <BalanceRow
            icon={<span className="text-[11px] font-black lowercase leading-none text-brand-dark">bp</span>}
            label="Saldo combustível"
            value="12,00€"
          />
        </div>

        {/* Campanhas */}
        <h2 className="mt-6 text-xl font-extrabold text-ink">Campanhas</h2>
        <CampanhaBanner />

        {/* Coupons carousel */}
        <button
          type="button"
          onClick={() => onNavigate('coupons')}
          className="mt-6 block w-full text-left"
        >
          <h2 className="text-xl font-extrabold text-ink">
            Tem {config.coupons.length}{' '}
            {config.coupons.length === 1 ? 'cupão disponível' : 'cupões disponíveis'}
          </h2>
        </button>

        <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {config.coupons.map((coupon) => (
            <button
              key={coupon.id}
              type="button"
              onClick={() => setSelected(coupon)}
              className="flex w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-card"
            >
              <PromoArt coupon={coupon} className="w-[120px] shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                  {coupon.title}
                </p>
                <span className="mt-2 self-start rounded-lg bg-brand-mid px-4 py-1.5 text-[12px] font-bold text-white">
                  Ver código
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <ActionTile icon={<TagIcon className="h-6 w-6" />} label="Poupa Mais" onClick={onOpenCard} />
          <ActionTile icon={<StoreIcon className="h-6 w-6" />} label="Lojas Pingo Doce" />
          <ActionTile
            icon={
              <div className="flex -space-x-1">
                <span className="h-4 w-4 rounded-full border-2 border-current" />
                <span className="h-4 w-4 rounded-full border-2 border-current" />
              </div>
            }
            label="Clubes"
          />
          <ActionTile
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
                <path d="M3 4h2l2.2 11a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L20 8H6.5" />
              </svg>
            }
            label="Últimas compras"
          />
        </div>
      </div>

      {selected && <CouponDetail coupon={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/** "Ganhe até 30€! — Comprou Pingou" campaign banner (recreated in markup). */
function CampanhaBanner() {
  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-campaign-from to-campaign-to p-5 shadow-card">
      {/* Decorative circle with the "Comprou Pingou" mark */}
      <div className="absolute -right-6 -top-4 flex h-44 w-44 items-center justify-center rounded-full bg-campaign-disc/70">
        <div className="rotate-[-8deg] text-center leading-none">
          <span className="block text-[15px] font-black italic tracking-tight text-brand-deep">
            <span className="text-accent-red">✓</span>COMPROU
          </span>
          <span className="block text-[19px] font-black italic tracking-tight text-accent-red">
            PING<span className="text-brand-deep">O</span>U
          </span>
        </div>
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-red text-[11px] font-black text-white">€</span>
        <span className="absolute bottom-4 right-8 flex h-5 w-5 items-center justify-center rounded-full bg-accent-red text-[10px] font-black text-white">€</span>
      </div>

      <div className="relative max-w-[62%]">
        <p className="text-2xl font-black leading-tight text-brand-deep">Ganhe até 30€!</p>
        <p className="mt-1 text-sm font-semibold text-brand-deep/90">De 18 a 23 de agosto</p>
        <span className="mt-4 inline-block rounded-lg bg-brand-deep px-5 py-2.5 text-[13px] font-bold text-white shadow-sm">
          Saber Mais
        </span>
      </div>
    </div>
  );
}

function BalanceRow({
  icon,
  label,
  sublabel,
  pill,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  pill?: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-2xl shadow-card ${highlight ? 'bg-brand-tint' : 'bg-white'}`}
    >
      <div className="flex w-[76px] shrink-0 items-center justify-center bg-brand-tint">{icon}</div>
      <div className="flex flex-1 items-center justify-between px-4 py-4">
        <div>
          <p className="text-[17px] font-semibold text-ink">{label}</p>
          {sublabel && <p className="text-[13px] text-ink-soft">{sublabel}</p>}
          {pill && (
            <span className="mt-1 inline-block rounded-full bg-white/70 px-2.5 py-0.5 text-[12px] text-ink-soft">
              {pill}
            </span>
          )}
        </div>
        <p className="text-[19px] font-extrabold text-brand-dark">{value}</p>
      </div>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[110px] flex-col items-center justify-center gap-2.5 rounded-2xl bg-white text-brand-dark shadow-card transition-transform duration-100 active:scale-[0.98]"
    >
      {icon}
      <span className="text-[15px] font-bold">{label}</span>
    </button>
  );
}
