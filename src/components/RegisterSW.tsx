'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that precaches the app shell, making the
 * installed PWA load instantly (and work offline) in store conditions.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Skip registration during `next dev` to avoid stale-cache confusion
    if (process.env.NODE_ENV !== 'production') return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
      // Registration failures (e.g. unsupported browser) are non-fatal
    });
  }, []);

  return null;
}
