'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A falha do service worker não deve bloquear o uso normal do app.
    });
  }, []);

  return null;
}
