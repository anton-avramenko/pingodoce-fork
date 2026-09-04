'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppConfig } from './types';

const STORAGE_KEY = 'pd-poc:config:v1';

/** Demo data used on first launch so the app is presentable out of the box. */
export function defaultConfig(): AppConfig {
  return {
    // Demo placeholders only — never real card numbers (this repo is public).
    // Configure real values in-app via the "Listas" → gear setup screen.
    // Numbers are valid EAN-13 (the symbology Pingo Doce / BP codes use).
    cardNumber: '2400000000006',
    poupaMaisNumber: '2410000000005',
    cardFormat: 'EAN13',
    userName: 'Cliente Demo',
    aiProvider: 'anthropic',
    aiApiKey: '',
    googleApiKey: '',
    googleModel: '',
    coupons: [
      {
        id: 'demo-fuel',
        title: 'Cupão de 15€ Combustível BP',
        discount: '15€',
        barcode: '9990000000005',
        format: 'EAN13',
        startsAt: todayIso(),
        expiresAt: inDaysIso(5),
        conditions:
          '15€ de oferta num posto de abastecimento bp de Portugal Continental. Válido numa única utilização, mediante apresentação do código na caixa. Não acumulável com outras campanhas.',
        kind: 'fuel',
      },
      {
        id: 'demo-store',
        title: 'Cupão de 15€ em Saldo na 1.ª compra',
        discount: '15€',
        barcode: '9990000000012',
        format: 'EAN13',
        startsAt: todayIso(),
        expiresAt: inDaysIso(5),
        conditions:
          'Oferta de 15€ em Saldo Pingo Doce na primeira compra igual ou superior a 100€. Válido numa única utilização, mediante apresentação do código na caixa.',
        kind: 'store',
      },
    ],
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function loadConfig(): AppConfig {
  if (typeof window === 'undefined') return defaultConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    // Merge over defaults so newly added fields never come back undefined
    return { ...defaultConfig(), ...parsed, coupons: parsed.coupons ?? [] };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage may be unavailable (private mode / quota) — the app keeps
    // working with in-memory state for the current session.
  }
}

export function resetConfig(): AppConfig {
  const fresh = defaultConfig();
  saveConfig(fresh);
  return fresh;
}

/**
 * React hook exposing the persisted configuration.
 *
 * The config is read from localStorage after mount (never during SSR /
 * static prerender) and every update is written back synchronously, so the
 * app loads instantly with the correct data on subsequent visits.
 */
export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const update = useCallback((next: AppConfig) => {
    setConfig(next);
    saveConfig(next);
  }, []);

  const reset = useCallback(() => {
    setConfig(resetConfig());
  }, []);

  return { config, update, reset };
}
