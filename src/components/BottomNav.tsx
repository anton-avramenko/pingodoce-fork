'use client';

import type { ReactNode } from 'react';
import {
  ClocheIcon,
  HomeIcon,
  ListCheckIcon,
  PercentBadgeIcon,
  TicketIcon,
} from './icons';

export type Tab = 'home' | 'coupons' | 'promos' | 'lists' | 'meals';

interface BottomNavProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: (cls: string) => ReactNode }[] = [
  { id: 'home', label: 'Início', icon: (cls) => <HomeIcon className={cls} /> },
  { id: 'coupons', label: 'Cupões', icon: (cls) => <TicketIcon className={cls} /> },
  { id: 'promos', label: 'Promoções', icon: (cls) => <PercentBadgeIcon className={cls} /> },
  { id: 'lists', label: 'Listas', icon: (cls) => <ListCheckIcon className={cls} /> },
  { id: 'meals', label: 'Refeições', icon: (cls) => <ClocheIcon className={cls} /> },
];

/**
 * Fixed bottom navigation bar replicating the native app tab bar
 * (Início · Cupões · Promoções · Listas · Refeições).
 * Switching is pure client state — no route change — so transitions are
 * instantaneous.
 */
export default function BottomNav({ active, onSelect }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-line bg-white shadow-nav"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex h-[60px] max-w-md items-stretch">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150 active:bg-surface-muted ${
                isActive ? 'text-brand-dark' : 'text-ink-faint'
              }`}
            >
              {tab.icon('h-[22px] w-[22px]')}
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
