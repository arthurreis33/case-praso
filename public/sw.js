// RNF04 · service worker simples: a página abre mesmo se a aba recarregar sem sinal.
// Estratégia: cache primeiro (abre instantâneo e offline) e atualização em segundo plano.
// Uma versão nova publicada aparece no segundo carregamento. Troque VERSAO a cada deploy.
const VERSAO = 'campo-v1-2026-10-05-1';
const ARQUIVOS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/store.js', 'js/rules.js', 'js/catalogo.js', 'js/export.js', 'js/ui.js', 'js/geo.js', 'js/seed.js',
  'js/views/lista.js', 'js/views/ponto.js', 'js/views/visita.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const emCache = await cache.match(req, { ignoreSearch: true });
      const daRede = fetch(req)
        .then((r) => { if (r.ok) cache.put(req, r.clone()); return r; })
        .catch(() => null);
      if (emCache) { e.waitUntil(daRede); return emCache; }
      return (await daRede) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }),
  );
});
