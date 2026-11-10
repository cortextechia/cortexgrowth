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
