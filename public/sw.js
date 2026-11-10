// Service worker do app instalável (PWA).
//
// Regra: NADA da API nem das páginas do painel é guardado em cache. Dado velho no
// celular (venda que já mudou, conversa sem a última mensagem) ou dado de outra conta
// depois de trocar o login seria pior que mostrar "sem conexão". A única coisa guardada
// é a página de sem conexão.
const CACHE = 'cromalex-offline-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Só navegação (abrir uma página). Com rede, vai direto à rede; sem rede, a página offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
  } else if (new URL(req.url).pathname === '/icon-192.png') {
    event.respondWith(fetch(req).catch(() => caches.match('/icon-192.png')));
  }
});

// Aviso do CRM (lead novo, mensagem, sem resposta, resumo do dia). O servidor manda
// { title, body, url, tag }; o mesmo `tag` substitui o aviso anterior do mesmo cliente.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Cromalex', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/dashboard/crm' },
  }));
});

// Tocar no aviso: reaproveita uma janela do app aberta, senão abre uma nova, já no card.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Só abre página do próprio site — endereço de fora cai no CRM.
  const alvo = new URL(event.notification.data?.url || '/dashboard/crm', self.location.origin);
  const destino = alvo.origin === self.location.origin ? alvo.href : new URL('/dashboard/crm', self.location.origin).href;
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of janelas) {
      if (new URL(w.url).origin === self.location.origin && 'navigate' in w) {
        await w.focus();
        return w.navigate(destino);
      }
    }
    return self.clients.openWindow(destino);
  })());
});
