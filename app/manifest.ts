import type { MetadataRoute } from 'next';

// App instalável (PWA). O ícone e as cores seguem a marca Cromalex; o fundo é o --bg-base
// do tema escuro, que é o tema padrão.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'Cromalex Growth',
    short_name: 'Cromalex',
    description: 'CRM, WhatsApp e resultados de marketing da sua empresa.',
    lang: 'pt-BR',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c0d0f',
    theme_color: '#0c0d0f',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
