/** @file Cache de recursos públicos por lista permitida; nunca intercepta respostas autenticadas ou API. */
// Incremente a versão quando os arquivos estáticos forem alterados.
const CACHE = 'ecocycle-static-v6';
const FILES = [
    './', './index.html', './login.html', './dashboard.html', './esteira.html', './alertas.html', './producao.html', './menu.html',
    './css/style.css', './css/login.css', './css/esteira.css', './css/alertas.css', './css/producao.css', './css/menu.css',
    './js/config.js', './js/api.js', './js/auth.js', './js/mocks.js', './js/ui.js', './js/dashboard.js',
    './js/esteira.js', './js/alertas.js', './js/estoque.js', './js/login-page.js', './js/menu-page.js', './js/pwa.js',
    './js/app.js', './js/adapters.js', './js/monitor.js', './instalar.html', './indisponivel.html',
    './assets/vendor/lucide.min.js',
    './manifest.json', './assets/icons/favicon.svg', './assets/icons/symbols.svg',
    './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/maskable-512.png'
];
const allowed = new Set(FILES.map(file => new URL(file, self.registration.scope).href));

self.addEventListener('install', event => {
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
    if (request.method !== 'GET' || request.headers.has('Authorization') || !allowed.has(request.url)) return;
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
});
