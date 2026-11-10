'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

// Aviso "instale o app" no celular.
// Android/Chrome: o navegador entrega o evento beforeinstallprompt e o botão abre a instalação.
// iPhone: a Apple não deixa o site abrir a instalação — o aviso ensina o caminho
// (Compartilhar › Adicionar à Tela de Início). Sem isso, a notificação nem chega no iPhone.
// Some quando o app já está instalado e volta 14 dias depois de fechado.

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CHAVE = 'pwa_install_dismissed_at';
const PRAZO_MS = 14 * 86_400_000;

type Plataforma = 'ios' | 'outra' | null;

function lerPlataforma(): Plataforma {
  const instalado = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (instalado || !window.matchMedia('(max-width: 767px)').matches) return null;
  try {
    const em = Number(localStorage.getItem(CHAVE));
    if (em && Date.now() - em < PRAZO_MS) return null;
  } catch { /* armazenamento bloqueado: mostra o aviso */ }
  // iPadOS se apresenta como Mac; o toque denuncia.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'outra';
}

const nadaMuda = () => () => {};

export default function InstalarApp() {
  const plataforma = useSyncExternalStore(nadaMuda, lerPlataforma, () => null);
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    const pegar = (e: Event) => { e.preventDefault(); setEvento(e as BeforeInstallPromptEvent); };
    const instalou = () => setFechado(true);
    window.addEventListener('beforeinstallprompt', pegar);
    window.addEventListener('appinstalled', instalou);
    return () => {
      window.removeEventListener('beforeinstallprompt', pegar);
      window.removeEventListener('appinstalled', instalou);
    };
  }, []);

  const fechar = () => {
    setFechado(true);
    try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem armazenamento: só some nesta visita */ }
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === 'accepted') setFechado(true);
  };

  // Android só mostra quando o navegador confirmou que dá para instalar.
  if (fechado || !plataforma || (plataforma === 'outra' && !evento)) return null;

  return (
    <div className="mx-4 mt-3 ui-card ui-card-hl !p-4 flex items-start gap-3" role="region" aria-label="Instalar o app">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-[10px] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Use o Cromalex como app</p>
        {plataforma === 'ios' ? (
          <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
            No Safari, toque em{' '}
            <svg aria-label="Compartilhar" className="inline h-4 w-4 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: 'var(--text-primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12l-4 4m4-4l4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1" />
            </svg>{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Compartilhar</strong> e depois em{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Adicionar à Tela de Início</strong>. É assim que os avisos de cliente novo chegam no iPhone.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              Abra direto da tela inicial, em tela cheia, e receba os avisos de cliente novo.
            </p>
            <button onClick={instalar} className="ui-btn ui-btn-primary ui-btn-sm mt-3">Instalar app</button>
          </>
        )}
      </div>
      <button onClick={fechar} className="ui-btn ui-btn-secondary ui-btn-sm !px-2.5 shrink-0" aria-label="Fechar aviso">✕</button>
    </div>
  );
}
