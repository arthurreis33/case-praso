// Mapa (seção 6.4): Leaflet + tiles do OpenStreetMap, com atribuição.
// NÃO usa Google Places nem o SDK do Google Maps: os termos proíbem usar conteúdo do Places em mapa
// que não seja do Google e limitam o cache. O Google entra só como deep link de navegação.
//  · pino com cor E letra por estado (nada depende só de cor), legenda e filtros (estado, tipo, pontos);
//  · camada "Desconhecidos" desligada por padrão (Receita fora da carteira, mapa aberto sem CNPJ);
//  · corrigir pino: segurar (ou "Corrigir pino"), arrastar e confirmar; o check-in sempre prevalece;
//  · Click2Create: segurar no mapa, ou "Estou aqui", cria um ponto na posição.
// Leaflet fica em public/vendor (BSD-2) e é guardado pelo service worker: o app abre offline;
// sem rede, só os tiles de fundo não carregam (os já vistos ficam em cache).
import { ESTADOS, TIPOS, rotulo } from '../catalogo.js';
import { esc, toast, seloEstado, seloPontos, letraEstado, confirmar, mapsUrl, janelaTexto } from '../ui.js';
import { coordDe, pontosValor } from '../rules.js';
import { nomeDe } from '../store.js';
import { prazoHtml } from './componentes.js';

const ui = { estados: new Set(), tipo: '', pontos: '', desconhecidos: false, centro: null, zoom: null };
const COR = { lead: '#4d4d4d', cadastrado_sem_compra: '#0047b3', ativacao: '#9a4d00', recorrente: '#0a6b2d', ativacao_vencida: '#6b2fa3', churn: '#a30000' };

let carregando = null;
export function carregarLeaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  if (carregando) return carregando;
  carregando = new Promise((ok, erro) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'vendor/leaflet/leaflet.css' });
    document.head.appendChild(css);
    const s = Object.assign(document.createElement('script'), { src: 'vendor/leaflet/leaflet.js' });
    s.onload = () => ok(globalThis.L);
    s.onerror = () => { carregando = null; erro(new Error('não carregou o Leaflet')); };
    document.head.appendChild(s);
  });
  return carregando;
}

export function renderMapa({ main, barra, store, ir, params, render }) {
  const foco = params.pino || params.foco || null;
  if (params.lat && params.lng) { ui.centro = [+params.lat, +params.lng]; ui.zoom = 17; ui.desconhecidos = true; }
  main.innerHTML = `
    <div class="chips rolagem" aria-label="Filtrar por estado">
      <button type="button" class="chip" id="f-desc" aria-pressed="${ui.desconhecidos}">? Desconhecidos</button>
      ${ESTADOS.map(([k, r]) => `<button type="button" class="chip" data-f-estado="${k}" aria-pressed="${ui.estados.has(k)}"><span class="selo-estado e-${k}" style="padding:1px;margin-right:4px"><i>${letraEstado(k)}</i></span>${esc(r)}</button>`).join('')}
    </div>
    <div class="linha-btns" style="margin:4px 0 6px">
      <select id="f-tipo" aria-label="Filtrar por tipo" style="flex:1;min-height:48px;min-width:0"><option value="">Tipo: todos</option>${TIPOS.map(([k, r]) => `<option value="${k}"${ui.tipo === k ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <select id="f-pontos" aria-label="Filtrar por pontos" style="flex:1;min-height:48px;min-width:0"><option value="">Pontos: todos</option><option value="3"${ui.pontos === '3' ? ' selected' : ''}>3 pt</option><option value="1"${ui.pontos === '1' ? ' selected' : ''}>1 pt</option><option value="0.5"${ui.pontos === '0.5' ? ' selected' : ''}>0,5 pt</option></select>
    </div>
    <div class="mapa-wrap"><div id="mapa" role="application" aria-label="Mapa dos pontos"></div></div>
    <div id="mapa-aviso"></div>
    <div class="legenda" aria-label="Legenda">${ESTADOS.map(([k, r]) => `<span><span class="selo-estado e-${k}" style="padding:1px"><i>${letraEstado(k)}</i></span>${esc(r)}</span>`).join('')}<span><span class="pino desconhecido" style="width:18px;height:18px;display:inline-grid"><b style="font-size:10px">?</b></span>Desconhecido</span></div>
    <p class="dica">Segure no mapa para criar um ponto ali. Segure um pino (ou use "Corrigir pino") para arrastá-lo.</p>`;

  barra.innerHTML = `<button class="btn primaria grande" data-acao-m="estou-aqui">Estou aqui: novo ponto</button><a class="btn grande" href="#/descobrir">Descobrir</a>`;

  let mapa = null;
  let camada = null;
  let camadaDesc = null;
  let arrastando = null;
  let morto = false;
  const marcadores = new Map();

  carregarLeaflet().then((L) => {
    if (morto) return;
    const base = store.vendedor().base || { lat: -8.11, lng: -34.9 };
    mapa = L.map(main.querySelector('#mapa'), { zoomControl: true, tap: true }).setView(ui.centro || [base.lat, base.lng], ui.zoom || 14);
    let erros = 0;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>',
    }).on('tileerror', () => {
      if (++erros === 3) main.querySelector('#mapa-aviso').innerHTML = '<div class="mapa-offline">Sem rede: o mapa de fundo não carrega, mas os pinos e os registros continuam funcionando.</div>';
    }).addTo(mapa);
    camada = L.layerGroup().addTo(mapa);
    camadaDesc = L.layerGroup();
    desenhar(L);
    if (!ui.centro && !foco && marcadores.size) mapa.fitBounds(L.featureGroup([...marcadores.values()]).getBounds(), { padding: [20, 20], animate: false });
    mapa.on('moveend', () => { ui.centro = mapa.getCenter(); ui.zoom = mapa.getZoom(); });
    // Click2Create: segurar no mapa (no toque, o Leaflet entrega como contextmenu)
    mapa.on('contextmenu', async (e) => {
      if (arrastando) return;
      if (await confirmar('Criar ponto aqui?', `Novo ponto em ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}. Você completa o cadastro em seguida.`, 'Criar ponto')) {
        ir(`#/novo/gps?lat=${e.latlng.lat.toFixed(6)}&lng=${e.latlng.lng.toFixed(6)}`);
      }
    });
    if (foco) {
      const m = marcadores.get(foco);
      const p = store.ponto(foco);
      const c = p && coordDe(p);
      if (c) mapa.setView([c.lat, c.lng], 17);
      if (m && params.pino) setTimeout(() => iniciarArraste(foco), 300);
      else m?.openPopup();
    }
  }).catch((e) => {
    main.querySelector('#mapa').innerHTML = `<div class="mapa-offline">Mapa indisponível (${esc(e.message)}). A Carteira e o Hoje seguem funcionando.</div>`;
  });

  function visivel(p) {
    if (ui.estados.size && !ui.estados.has(p.estado)) return false;
    if (ui.tipo && p.tipo !== ui.tipo) return false;
    if (ui.pontos && String(pontosValor(p)) !== ui.pontos) return false;
    return true;
  }

  function icone(L, estado, extra = '') {
    return L.divIcon({ className: '', html: `<div class="pino ${extra}" style="--cor:${COR[estado]}"><b>${letraEstado(estado)}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 34], popupAnchor: [0, -30] });
  }

  function popupPonto(p) {
    const sit = store.situacao(p.id);
    const c = p.coord_confirmada;
    return `<div style="min-width:200px;font:15px/1.35 system-ui,sans-serif">
      <b>${esc(nomeDe(p))}</b><br>${seloEstado(sit.estado)} ${seloPontos(pontosValor(p))}<br>
      <span style="font-size:13px">${esc(rotulo(TIPOS, p.tipo))}${p.decisor ? ` · ${esc(janelaTexto(p.decisor))}` : ''}</span><br>
      ${prazoHtml(sit)}
      <div style="font-size:12px;color:#474747;margin-top:4px">${c ? `pino ${c.origem === 'checkin' ? 'confirmado em visita' : 'corrigido à mão'}` : 'pino do cadastro (não confirmado)'}</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <a class="btn peq" href="#/ponto/${esc(p.id)}">Ficha</a>
        <button type="button" class="btn peq" data-arrastar="${esc(p.id)}">Corrigir pino</button>
        <a class="btn peq" href="${esc(mapsUrl(p))}" target="_blank" rel="noopener">Rota</a>
      </div></div>`;
  }

  function desenhar(L = globalThis.L) {
    if (!mapa) return;
    camada.clearLayers();
    marcadores.clear();
    for (const p of store.meusPontos()) {
      const c = coordDe(p);
      if (!c || !visivel(p)) continue;
      const m = L.marker([c.lat, c.lng], { icon: icone(L, p.estado), title: `${nomeDe(p)} · ${rotulo(ESTADOS, p.estado)}`, alt: nomeDe(p), keyboard: true, draggable: false });
      m.bindPopup(() => popupPonto(p));
      m.on('contextmenu', (e) => { L.DomEvent.stop(e); iniciarArraste(p.id); });
      m.on('dragend', () => terminarArraste(p.id, m));
      m.addTo(camada);
      marcadores.set(p.id, m);
    }
    camadaDesc.clearLayers();
    for (const d of store.estado.desconhecidos.filter((x) => x.status === 'novo')) {
      const m = L.marker([d.lat, d.lng], { icon: L.divIcon({ className: '', html: '<div class="pino desconhecido"><b>?</b></div>', iconSize: [26, 26], iconAnchor: [13, 13] }), title: `${d.nome} · desconhecido` });
      m.bindPopup(`<div style="min-width:190px;font:15px/1.35 system-ui,sans-serif"><b>${esc(d.nome)}</b><br><span style="font-size:13px">${esc(GRUPO[d.grupo])}${d.mei != null ? ` · ${d.mei ? 'MEI' : 'não MEI'}` : ''}</span><br><span style="font-size:12px;color:#474747">${esc(d.fonte)}</span><div style="margin-top:8px"><a class="btn peq" href="#/descobrir">Ver na fila Descobrir</a></div></div>`);
      m.addTo(camadaDesc);
    }
    if (ui.desconhecidos) camadaDesc.addTo(mapa); else camadaDesc.remove();
  }

  function iniciarArraste(id) {
    const m = marcadores.get(id);
    if (!m) return;
    if (arrastando && arrastando !== id) marcadores.get(arrastando)?.dragging.disable();
    arrastando = id;
    m.closePopup();
    m.dragging.enable();
    m.getElement()?.querySelector('.pino')?.classList.add('arrastando');
    toast('Arraste o pino até o lugar certo e solte', 4000);
  }

  async function terminarArraste(id, m) {
    const ll = m.getLatLng();
    const p = store.ponto(id);
    const ok = await confirmar('Mover o pino?', `${nomeDe(p)} passa a ficar em ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}. O próximo check-in confirma de novo.`, 'Mover pino');
    m.dragging.disable();
    arrastando = null;
    if (ok) {
      store.corrigirPino(id, { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }, 'manual');
      toast('Pino corrigido');
    } else {
      const c = coordDe(p);
      m.setLatLng([c.lat, c.lng]);
    }
    m.getElement()?.querySelector('.pino')?.classList.remove('arrastando');
  }

  main.addEventListener('click', (ev) => {
    const e = ev.target.closest('[data-f-estado]')?.dataset.fEstado;
    if (e) { ui.estados.has(e) ? ui.estados.delete(e) : ui.estados.add(e); ev.target.closest('.chip').setAttribute('aria-pressed', ui.estados.has(e)); return desenhar(); }
    if (ev.target.closest('#f-desc')) { ui.desconhecidos = !ui.desconhecidos; ev.target.closest('#f-desc').setAttribute('aria-pressed', ui.desconhecidos); return desenhar(); }
    const a = ev.target.closest('[data-arrastar]')?.dataset.arrastar;
    if (a) iniciarArraste(a);
  });
  main.querySelector('#f-tipo').addEventListener('change', (e) => { ui.tipo = e.target.value; desenhar(); });
  main.querySelector('#f-pontos').addEventListener('change', (e) => { ui.pontos = e.target.value; desenhar(); });
  barra.onclick = (ev) => { if (ev.target.closest('[data-acao-m="estou-aqui"]')) ir('#/novo/gps'); };

  return () => { morto = true; if (mapa) { mapa.off(); mapa.stop(); mapa.remove(); } };
}

export const GRUPO = { receita: 'Na Receita, fora da carteira', mapa_aberto: 'No mapa aberto, sem CNPJ', baixa_confianca: 'Casado com baixa confiança' };
