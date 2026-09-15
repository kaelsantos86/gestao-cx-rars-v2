self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', () => {
  // Sem cache de conteúdo autenticado: o app continua usando sempre a versão atual da V2.
});
