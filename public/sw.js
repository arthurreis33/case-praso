// Service worker: o app abre mesmo sem sinal (shell inteiro em cache) e atualiza em segundo plano.
// Estratégia: cache primeiro para o app; tiles do OpenStreetMap em cache separado e limitado
// (só os já vistos, sem pré-carga em massa, conforme a política de uso dos tiles do OSM).
// A versão nova publicada aparece no segundo carregamento. Troque VERSAO a cada deploy.
const VERSAO = 'campo-v2-2-2026-10-06-1';
const TILES = 'campo-tiles-v1';
const MAX_TILES = 400;
const ARQUIVOS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'img/logo-praso.png',
  'img/icone-180.png',
  'img/icone-192.png',
  'img/icone-512.png',
  'js/app.js',
  'js/catalogo.js',
  'js/config.js',
  'js/db.js',
  'js/demo.js',
  'js/icones.js',
  'js/demo/catalogo.js',
  'js/estados.js',
  'js/export.js',
  'js/extrair.js',
  'js/geo.js',
  'js/historico.js',
  'js/migrar.js',
  'js/painel.js',
  'js/plano.js',
  'js/prioridade.js',
  'js/proxima.js',
  'js/rota.js',
  'js/rules.js',
  'js/seed.js',
  'js/store.js',
  'js/ui.js',
  'js/views/carteira.js',
  'js/views/componentes.js',
  'js/views/descobrir.js',
  'js/views/ficha.js',
  'js/views/hoje.js',
  'js/views/mapa.js',
  'js/views/novo.js',
  'js/views/painel.js',
  'js/views/perfil.js',
  'js/views/sim.js',
  'js/views/visita.js',
  'js/voz.js',
  'js/whatsapp.js',
  'fonts/inter-latin-wght.woff2',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-shadow.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') {
      await cache.put(req, r.clone());
      const ks = await cache.keys();
      for (const k of ks.slice(0, Math.max(0, ks.length - MAX_TILES))) await cache.delete(k);
    }
    return r;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname.endsWith('tile.openstreetmap.org')) { e.respondWith(tile(req)); return; }
  if (u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;
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
