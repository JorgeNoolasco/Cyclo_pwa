// Aumente a versão a cada publicação que alterar arquivos estáticos (inclusive config.js).
const CACHE = 'ecocycle-static-v1';
const FILES = [
  './', './index.html', './login.html', './dashboard.html', './esteira.html', './alertas.html', './estoque.html',
  './css/style.css', './css/components.css', './css/mobile.css',
  './js/config.js', './js/api.js', './js/auth.js', './js/mocks.js', './js/app.js',
  './js/ui.js', './js/dashboard.js', './js/esteira.js', './js/alertas.js', './js/estoque.js',
  './manifest.json', './assets/icons/favicon.svg', './assets/icons/symbols.svg',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/maskable-512.png'
];
const allowed = new Set(FILES.map(file => new URL(file, self.registration.scope).href));
self.addEventListener('install', event => {
  // Sem skipWaiting: uma nova versão só assume quando as abas antigas forem fechadas.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('ecocycle-static-') && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  // Lista fechada: nunca intercepta login, API, respostas autenticadas ou origens externas.
  if (request.method !== 'GET' || request.headers.has('Authorization') || !allowed.has(request.url)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});
