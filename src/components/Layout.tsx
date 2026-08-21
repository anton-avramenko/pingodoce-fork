'use client';

import { useCallback, useRef, useState } from 'react';
import { useAppConfig } from '@/lib/storage';
import BottomNav, { type Tab } from './BottomNav';
import CardView from './CardView';
import CouponsView from './CouponsView';
import HomeView from './HomeView';
import SetupView from './SetupView';
import {
  BrandMark,
  CardIcon,
  ChevronDownIcon,
  ClockIcon,
  GearIcon,
  MailIcon,
  PersonIcon,
  SearchIcon,
} from './icons';

interface LayoutProps {
  /** Open the hidden setup screen immediately (used by the /setup route). */
  startInSetup?: boolean;
  /** Tab shown on first paint. */
  initialTab?: Tab;
}

/** Number of rapid taps on the profile icon that unlock the setup screen. */
const SECRET_TAP_COUNT = 5;
/** Maximum pause between taps (ms) before the counter resets. */
const SECRET_TAP_WINDOW = 600;

/**
 * App shell: white top bar + tab views + fixed bottom navigation, plus the
 * floating "Usar cartão" action that opens the digital card as a full-screen
 * overlay — matching the app, and keeping the coupon→card hand-off instant.
 */
export default function Layout({ startInSetup = false, initialTab = 'home' }: LayoutProps) {
  const { config, update, reset } = useAppConfig();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [setupOpen, setSetupOpen] = useState(startInSetup);
  const [cardOpen, setCardOpen] = useState(false);

  // Hidden gesture: N rapid taps on the profile icon open the setup screen
  const tapCount = useRef(0);
  const lastTap = useRef(0);
  const handleSecretTap = useCallback(() => {
    const now = Date.now();
    tapCount.current = now - lastTap.current < SECRET_TAP_WINDOW ? tapCount.current + 1 : 1;
    lastTap.current = now;
    if (tapCount.current >= SECRET_TAP_COUNT) {
      tapCount.current = 0;
      setSetupOpen(true);
    }
  }, []);

  // Config is loaded from localStorage after mount; show a branded splash for
  // that single frame to avoid a flash of empty content.
  if (!config) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <BrandMark className="h-14 w-14 animate-fade-in text-brand" />
      </div>
    );
  }

  const views: Record<Tab, React.ReactNode> = {
    home: <HomeView config={config} onNavigate={setTab} onOpenCard={() => setCardOpen(true)} />,
    coupons: <CouponsView config={config} />,
    promos: <Placeholder title="Promoções" subtitle="As promoções da semana aparecem aqui." />,
    lists: <ListsView onOpenSetup={() => setSetupOpen(true)} />,
    meals: <Placeholder title="Refeições" subtitle="Sugestões e receitas aparecem aqui." />,
  };

  return (
    <div className="mx-auto min-h-dvh w-full bg-surface-muted">
      {/* White top bar */}
      <header
        className="sticky top-0 z-30 border-b border-surface-line bg-white"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-3 text-ink">
            <button type="button" onClick={handleSecretTap} aria-label="Perfil">
              <PersonIcon className="h-6 w-6" />
            </button>
            <MailIcon className="h-6 w-6" />
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[15px] font-bold text-ink">
              Figueira da Foz
              <ChevronDownIcon className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1 text-[11px] text-brand-dark">
              <ClockIcon className="h-3 w-3" />
              <span className="font-semibold">Aberto</span>
              <span className="text-ink-soft">08:00 - 21:00</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-ink">
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              POC
            </span>
            {/* Settings gear — appears only on the Listas tab */}
            {tab === 'lists' ? (
              <button
                type="button"
                onClick={() => setSetupOpen(true)}
                aria-label="Configuração"
                className="text-brand-dark"
              >
                <GearIcon className="h-6 w-6" />
              </button>
            ) : (
              <SearchIcon className="h-6 w-6" />
            )}
          </div>
        </div>
      </header>

      {/* Tab views — all mounted, only the active one visible */}
      <main className="relative pb-24">
        {(Object.keys(views) as Tab[]).map((id) => {
          const active = id === tab;
          return (
            <div key={id} className={active ? 'animate-view-in' : 'hidden'} aria-hidden={!active}>
              {views[id]}
            </div>
          );
        })}
      </main>

      {/* Floating "Usar cartão" action */}
      <button
        type="button"
        onClick={() => setCardOpen(true)}
        className="fixed bottom-[76px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-mid px-5 py-3 text-white shadow-lg shadow-brand/30 active:bg-brand-dark"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <CardIcon className="h-5 w-5" />
        <span className="text-[15px] font-bold">Usar cartão</span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-xs font-bold">
          {config.coupons.length}
        </span>
      </button>

      <BottomNav active={tab} onSelect={setTab} />

      {cardOpen && <CardView config={config} onClose={() => setCardOpen(false)} />}

      {setupOpen && (
        <SetupView
          config={config}
          onSave={update}
          onReset={reset}
          onClose={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Listas tab — also the visible entry point to the POC configuration.
 * The gear in the top bar (shown only on this tab) opens the same screen.
 */
function ListsView({ onOpenSetup }: { onOpenSetup: () => void }) {
  return (
    <div className="min-h-full bg-surface-muted">
      <div className="mx-auto max-w-md px-4 pt-4">
        <h1 className="text-center text-lg font-bold text-ink">Listas</h1>

        <button
          type="button"
          onClick={onOpenSetup}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card active:bg-surface-muted"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-dark">
            <GearIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-ink">Configuração (POC)</p>
            <p className="text-xs text-ink-soft">Editar cartão e cupões neste dispositivo</p>
          </div>
        </button>

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <BrandMark className="h-12 w-12 text-brand/40" />
          <p className="text-sm text-ink-soft">As suas listas de compras aparecem aqui.</p>
        </div>
      </div>
    </div>
  );
}

/** Simple placeholder for the tabs outside the POC's scope. */
function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-full bg-surface-muted">
      <div className="mx-auto max-w-md px-4 pt-4">
        <h1 className="text-center text-lg font-bold text-ink">{title}</h1>
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <BrandMark className="h-12 w-12 text-brand/40" />
          <p className="text-sm text-ink-soft">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
