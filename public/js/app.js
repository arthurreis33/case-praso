// Entrada do app: store (IndexedDB + diário), roteador por hash com 4 abas
// (Hoje · Mapa · Carteira · Painel) e telas por cima (ficha, visita, novo ponto, simulador).
import { criarStore, memoriaStorage } from './store.js';
import { adaptadorIndexedDB } from './db.js';
import { paraJSON, paraCSV, nomeArquivo, baixar, compartilhar, podeCompartilharArquivo } from './export.js';
import { esc, toast, quando } from './ui.js';
import { carregarSeed } from './seed.js';
import { renderHoje } from './views/hoje.js';
import { renderMapa } from './views/mapa.js';
import { renderCarteira } from './views/carteira.js';
import { renderPainel, renderGestor } from './views/painel.js';
import { renderFicha } from './views/ficha.js';
import { renderNovo } from './views/novo.js';
import { renderVisita } from './views/visita.js';
import { renderSim } from './views/sim.js';
import { renderDescobrir } from './views/descobrir.js';
import { iniciarFila, pendentesFila } from './voz.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('__teste__'); } catch { storage = null; }
const store = await criarStore({ adaptador: adaptadorIndexedDB(), storage: storage || memoriaStorage() }).carregar();
window.__store = store; // depuração no console
navigator.storage?.persist?.().catch(() => {});

// Quem abre o link pela primeira vez vê a demo funcionando: sem nenhum ponto, carrega o seed fictício.
let avisoMigracao = store.migrouV1 ? `${store.migrouV1} ponto${store.migrouV1 > 1 ? 's' : ''} da V1 migrado${store.migrouV1 > 1 ? 's' : ''} para a V2.` : null;
if (!store.estado.pontos.length) {
  const n = carregarSeed(store);
  setTimeout(() => toast(`${n} pontos fictícios carregados para a demonstração`), 300);
}

const barra = document.getElementById('barra');
const abas = document.getElementById('abas');
const avisos = document.getElementById('avisos');
const elRelogio = document.getElementById('relogio-sim');
const elStatus = document.getElementById('status-fila');
const elFilaN = document.getElementById('status-fila-n');
let limpar = null;

const ROTAS = [
  [/^#\/visita\/([\w-]+)$/, (c, m) => renderVisita(c, m[1]), true],
  [/^#\/ponto\/([\w-]+)\/editar$/, (c, m) => renderNovo(c, { id: m[1] }), true],
  [/^#\/ponto\/([\w-]+)$/, (c, m) => renderFicha(c, m[1]), true],
  [/^#\/novo\/gps$/, (c) => renderNovo(c, { gps: true }), true],
  [/^#\/novo$/, (c) => renderNovo(c, {}), true],
  [/^#\/sim$/, (c) => renderSim(c), true],
  [/^#\/descobrir$/, (c) => renderDescobrir(c), true],
  [/^#\/gestor$/, (c) => renderGestor(c), false, 'painel'],
  [/^#\/painel$/, (c) => renderPainel(c), false, 'painel'],
  [/^#\/mapa$/, (c) => renderMapa(c), false, 'mapa'],
  [/^#\/carteira$/, (c) => renderCarteira(c), false, 'carteira'],
  [/^#\/(hoje)?$/, (c) => renderHoje(c), false, 'hoje'],
];

function ir(hash, substituir = false) {
  if (location.hash === hash) return render();
  if (substituir) location.replace(hash); else location.hash = hash;
}

export function parametros() {
  const q = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

function render() {
  if (typeof limpar === 'function') { try { limpar(); } catch {} }
  limpar = null;
  barra.innerHTML = '';
  barra.onclick = null;
  const [h] = (location.hash || '#/hoje').split('?');
  const antigo = document.getElementById('app');
  const novo = antigo.cloneNode(false);
  antigo.replaceWith(novo);
  const ctx = { main: novo, barra, store, ir, params: parametros(), render };
  let achou = false;
  for (const [re, fn, sobre, aba] of ROTAS) {
    const m = h.match(re);
    if (!m) continue;
    achou = true;
    document.body.classList.toggle('sobreposicao', !!sobre);
    abas.querySelectorAll('a').forEach((a) => (a.dataset.aba === aba ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    try { limpar = fn(ctx, m); } catch (e) { console.error(e); novo.innerHTML = `<p class="aviso erro">Erro ao abrir a tela: ${esc(e.message)}</p>`; }
    break;
  }
  if (!achou) return ir('#/hoje', true);
  renderAvisos();
  renderTopo();
  ajustarBarra();
  window.scrollTo(0, 0);
}

function ajustarBarra() {
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--barra-h', barra.children.length ? `${barra.offsetHeight}px` : '0px');
  });
}
new MutationObserver(ajustarBarra).observe(barra, { childList: true });

function renderAvisos() {
  const h = location.hash || '#/hoje';
  const partes = [];
  if (store.erro) partes.push(`<div class="aviso erro">${esc(store.erro)}</div>`);
  if (avisoMigracao) {
    partes.push(`<div class="aviso info">${esc(avisoMigracao)} · <button type="button" class="link" data-acao="carregar-exemplo">carregar também a demo fictícia</button> · <button type="button" class="link" data-acao="fechar-migracao">ok</button></div>`);
  }
  const aberta = store.visitaAberta();
  if (aberta && !h.startsWith(`#/visita/${aberta.id}`)) {
    const p = store.ponto(aberta.ponto_id);
    partes.push(`<div class="aviso alerta">Visita aberta em ${esc(p?.nome_fantasia || '?')} · <a href="#/visita/${aberta.id}">continuar</a></div>`);
  }
  if (h === '#/hoje' || h === '#/' || h === '') {
    const desde = store.estado.ultimo_export;
    const n = store.estado.visitas.filter((v) => !v.ficticio && (!desde || v.checkin.em > desde)).length;
    if (n) partes.push(`<div class="aviso alerta">${n} visita${n > 1 ? 's' : ''} desde o último export · <button type="button" class="link" data-acao="abrir-export">exportar</button></div>`);
  }
  avisos.innerHTML = partes.join('');
}

function renderTopo() {
  const d = store.offsetDias;
  elRelogio.hidden = !d;
  elRelogio.textContent = d ? `relógio ${d > 0 ? '+' : ''}${d} d` : '';
  elRelogio.title = d ? `Relógio simulado: ${quando(store.agora().toISOString(), store.agora())}` : '';
  elStatus.classList.toggle('mem', store.emMemoria || !!store.erro);
  const n = pendentesFila(store);
  elFilaN.textContent = n ? String(n) : '';
  elStatus.setAttribute('aria-label', `${store.emMemoria ? 'Só em memória' : 'Salvo no aparelho'}${n ? ` · ${n} na fila de transcrição` : ''}`);
}

// ---------------- Export ----------------
const dlg = document.getElementById('dlg-export');
function abrirExport() {
  const e = store.estado;
  const reais = e.pontos.filter((p) => !p.ficticio).length;
  document.getElementById('export-resumo').textContent =
    `${e.pontos.length} pontos (${reais} reais) · ${e.visitas.length} visitas · ${e.pedidos.length} pedidos · último export: ${e.ultimo_export ? quando(e.ultimo_export) : 'nunca'}`;
  const pode = podeCompartilharArquivo();
  dlg.querySelectorAll('[data-compartilhar]').forEach((b) => { b.hidden = !pode; });
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

function abrirFila() {
  const n = pendentesFila(store);
  toast(`${store.emMemoria ? 'Só em memória: exporte antes de fechar.' : 'Tudo salvo no aparelho.'} ${n ? `${n} nota${n > 1 ? 's' : ''} de voz na fila de transcrição.` : 'Fila de transcrição vazia.'} Sem backend no protótipo: os dados ficam neste aparelho.`, 5000);
}

document.addEventListener('click', async (ev) => {
  const acao = ev.target.closest('[data-acao]')?.dataset.acao;
  if (!acao) return;
  try {
    if (acao === 'abrir-export') abrirExport();
    else if (acao === 'abrir-fila') abrirFila();
    else if (acao === 'fechar-migracao') { avisoMigracao = null; renderAvisos(); }
    else if (acao === 'baixar-csv') {
      baixar(paraCSV(store.estado), nomeArquivo('csv'), 'text/csv;charset=utf-8');
      store.marcarExport(); toast('CSV baixado'); renderAvisos();
    } else if (acao === 'baixar-json') {
      baixar(paraJSON(store.estado), nomeArquivo('json'), 'application/json');
      store.marcarExport(); toast('JSON baixado'); renderAvisos();
    } else if (acao === 'compartilhar-csv') {
      if (await compartilhar(paraCSV(store.estado), nomeArquivo('csv'), 'text/csv')) { store.marcarExport(); renderAvisos(); }
    } else if (acao === 'compartilhar-json') {
      if (await compartilhar(paraJSON(store.estado), nomeArquivo('json'), 'application/json')) { store.marcarExport(); renderAvisos(); }
    } else if (acao === 'carregar-exemplo') {
      store.removerFicticios();
      const n = carregarSeed(store); dlg.close?.(); avisoMigracao = null; toast(`${n} pontos fictícios carregados`); ir('#/hoje');
    } else if (acao === 'remover-exemplo') {
      const n = store.removerFicticios(); dlg.close?.(); toast(`${n} pontos fictícios removidos`); ir('#/hoje');
    }
  } catch (e) {
    toast(`Erro: ${e.message}`);
  }
});

document.getElementById('inp-importar').addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  if (!f) return;
  try {
    const n = store.importar(await f.text());
    dlg.close(); toast(`Backup importado: ${n} pontos`); ir('#/hoje');
  } catch (e) { toast(`Não importei: ${e.message}`); }
  ev.target.value = '';
});

store.aoMudar(renderTopo);
window.addEventListener('hashchange', render);
// ao voltar para a aba (ex.: depois do Maps ou do WhatsApp), relê a tela para atualizar horários
document.addEventListener('visibilitychange', () => {
  const h = location.hash;
  if (!document.hidden && !/visita|novo|editar|sim|mapa/.test(h)) render();
});
render();
iniciarFila(store, { aoMudar: renderTopo });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
