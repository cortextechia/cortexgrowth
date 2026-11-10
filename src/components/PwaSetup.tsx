'use client';

import { useEffect } from 'react';

// Registra o service worker (só em produção: no `next dev` ele atrapalharia o recarregamento)
// e mantém a cor da barra do sistema igual ao fundo do tema escolhido no app.
export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((err) => {
        console.error('[PWA] service worker não registrou:', err);
      });
    }

    const root = document.documentElement;
    const sync = () => {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      const cor = getComputedStyle(root).getPropertyValue('--bg-base').trim();
      if (meta && cor) meta.content = cor;
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return null;
}
