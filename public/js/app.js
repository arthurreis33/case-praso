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
import { renderPerfil } from './views/perfil.js';
import { modoDemo, ligarDemo, toqueNaMarca } from './demo.js';
import './icones.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('__teste__'); } catch { storage = null; }
const store = await criarStore({ adaptador: adaptadorIndexedDB(), storage: storage || memoriaStorage() }).carregar();
window.__store = store; // depuração no console
navigator.storage?.persist?.().catch(() => {});

ligarDemo(modoDemo()); // aplica a classe no <body>
// Primeira abertura: no modo demonstração, carrega os dados de exemplo; fora dele, a carteira começa vazia
// e o Hoje mostra as boas-vindas (com "ver com dados de exemplo").
let avisoMigracao = store.migrouV1 ? `${store.migrouV1} ponto${store.migrouV1 > 1 ? 's' : ''} da V1 migrado${store.migrouV1 > 1 ? 's' : ''} para a V2.` : null;
if (!store.estado.pontos.length && modoDemo()) {
  const n = carregarSeed(store);
  setTimeout(() => toast(`${n} pontos de exemplo carregados`), 300);
}

const barra = document.getElementById('barra');
const abas = document.getElementById('abas');
const avisos = document.getElementById('avisos');
const elRelogio = document.getElementById('relogio-sim');
const elStatus = document.getElementById('status-fila');
const elFilaN = document.getElementById('status-fila-n');
let limpar = null;
const btnVoltar = document.getElementById('btn-voltar');
// Profundidade da navegação dentro do app, gravada no próprio histórico: decide entre history.back() e ir para o Hoje
let profundidade = history.state?.d ?? 0;
let substituindo = false;
if (history.state?.d == null) history.replaceState({ d: 0 }, '');
let ultimoHash = null;
let ultimoSobre = false;
const rolagens = new Map(); // posição da rolagem por tela de aba, para voltar ao mesmo lugar

const ROTAS = [
  [/^#\/visita\/([\w-]+)$/, (c, m) => renderVisita(c, m[1]), true],
  [/^#\/ponto\/([\w-]+)\/editar$/, (c, m) => renderNovo(c, { id: m[1] }), true],
  [/^#\/ponto\/([\w-]+)$/, (c, m) => renderFicha(c, m[1]), true],
  [/^#\/novo\/gps$/, (c) => renderNovo(c, { gps: true }), true],
  [/^#\/novo$/, (c) => renderNovo(c, {}), true],
  [/^#\/sim$/, (c) => (modoDemo() ? renderSim(c) : c.ir('#/perfil', true)), true],
  [/^#\/perfil$/, (c) => renderPerfil(c), true],
  [/^#\/descobrir$/, (c) => renderDescobrir(c), true],
  [/^#\/gestor$/, (c) => renderGestor(c), true],
  [/^#\/painel$/, (c) => renderPainel(c), false, 'painel'],
  [/^#\/mapa$/, (c) => renderMapa(c), false, 'mapa'],
  [/^#\/carteira$/, (c) => renderCarteira(c), false, 'carteira'],
  [/^#\/(hoje)?$/, (c) => renderHoje(c), false, 'hoje'],
];

function ir(hash, substituir = false) {
  if (location.hash === hash) return render();
  if (substituir) { substituindo = true; location.replace(hash); } else location.hash = hash;
}

export function parametros() {
  const q = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

function render() {
  if (ultimoHash != null && !ultimoSobre) rolagens.set(ultimoHash, window.scrollY);
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
  let ehSobre = false;
  for (const [re, fn, sobre, aba] of ROTAS) {
    const m = h.match(re);
    if (!m) continue;
    achou = true;
    ehSobre = !!sobre;
    document.body.classList.toggle('sobreposicao', !!sobre);
    btnVoltar.hidden = !sobre;
    abas.querySelectorAll('a').forEach((a) => (a.dataset.aba === aba ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    try { limpar = fn(ctx, m); } catch (e) { console.error(e); novo.innerHTML = `<p class="aviso erro">Erro ao abrir a tela: ${esc(e.message)}</p>`; }
    break;
  }
  if (!achou) return ir('#/hoje', true);
  renderAvisos();
  renderTopo();
  ajustarBarra();
  // voltando de uma tela por cima para a aba de onde saiu: a rolagem volta ao mesmo lugar
  const y = !ehSobre && ultimoSobre ? rolagens.get(h) : null;
  window.scrollTo(0, y || 0);
  ultimoHash = h;
  ultimoSobre = ehSobre;
}

btnVoltar.addEventListener('click', () => {
  if (profundidade > 0) history.back(); else ir('#/hoje', true);
});

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
    partes.push(`<div class="aviso info">${esc(avisoMigracao)} · <button type="button" class="link" data-acao="carregar-exemplo">carregar também os dados de exemplo</button> · <button type="button" class="link" data-acao="fechar-migracao">ok</button></div>`);
  }
  const aberta = store.visitaAberta();
  if (aberta && !h.startsWith(`#/visita/${aberta.id}`)) {
    const p = store.ponto(aberta.ponto_id);
    partes.push(`<div class="aviso alerta">Visita aberta em ${esc(p?.nome_fantasia || '?')} · <a href="#/visita/${aberta.id}">continuar</a></div>`);
  }
  if (h === '#/hoje' || h === '#/' || h === '') {
    const desde = store.estado.ultimo_export;
    const n = store.estado.visitas.filter((v) => !v.ficticio && (!desde || v.checkin.em > desde)).length;
    if (n) partes.push(`<div class="aviso alerta">${n} visita${n > 1 ? 's' : ''} sem backup · <a href="#/perfil">fazer backup</a></div>`);
  }
  avisos.innerHTML = partes.join('');
}

function renderTopo() {
  const d = modoDemo() ? store.offsetDias : 0;
  elRelogio.hidden = !d;
  elRelogio.textContent = d ? `relógio ${d > 0 ? '+' : ''}${d} d` : '';
  elRelogio.title = d ? `Relógio simulado: ${quando(store.agora().toISOString(), store.agora())}` : '';
  elStatus.classList.toggle('mem', store.emMemoria || !!store.erro);
  const desde = store.estado.ultimo_export;
  const semBackup = store.estado.visitas.some((v) => !v.ficticio && (!desde || v.checkin.em > desde));
  document.getElementById('perfil-alerta').hidden = !semBackup;
  const n = pendentesFila(store);
  elFilaN.textContent = n ? String(n) : '';
  elStatus.setAttribute('aria-label', `${store.emMemoria ? 'Só em memória' : 'Salvo no aparelho'}${n ? ` · ${n} na fila de transcrição` : ''}`);
}

// ---------------- Backup (a tela fica em Perfil; as ações são globais) ----------------
function abrirFila() {
  const n = pendentesFila(store);
  toast(`${store.emMemoria ? 'Atenção: não está salvando no aparelho. Faça backup em Perfil antes de fechar.' : 'Tudo salvo neste aparelho.'} ${n ? `${n} nota${n > 1 ? 's' : ''} de voz esperando sinal para transcrever.` : ''}`, 5000);
}

document.addEventListener('click', async (ev) => {
  const acao = ev.target.closest('[data-acao]')?.dataset.acao;
  if (!acao) return;
  try {
    if (acao === 'abrir-export') ir('#/perfil');
    else if (acao === 'abrir-fila') abrirFila();
    else if (acao === 'fechar-migracao') { avisoMigracao = null; renderAvisos(); }
    else if (acao === 'baixar-csv') {
      baixar(paraCSV(store.estado), nomeArquivo('csv'), 'text/csv;charset=utf-8');
      store.marcarExport(); toast('Planilha baixada'); render();
    } else if (acao === 'baixar-json') {
      baixar(paraJSON(store.estado), nomeArquivo('json'), 'application/json');
      store.marcarExport(); toast('Backup baixado'); render();
    } else if (acao === 'compartilhar-csv') {
      if (await compartilhar(paraCSV(store.estado), nomeArquivo('csv'), 'text/csv')) { store.marcarExport(); render(); }
    } else if (acao === 'compartilhar-json') {
      if (await compartilhar(paraJSON(store.estado), nomeArquivo('json'), 'application/json')) { store.marcarExport(); render(); }
    } else if (acao === 'carregar-exemplo') {
      store.removerFicticios();
      const n = carregarSeed(store); ligarDemo(true); avisoMigracao = null; toast(`${n} pontos de exemplo carregados · modo demonstração ligado`, 3500); ir('#/hoje');
    } else if (acao === 'remover-exemplo') {
      const n = store.removerFicticios(); toast(`${n} pontos de exemplo removidos`); ir('#/hoje');
    }
  } catch (e) {
    toast(`Erro: ${e.message}`);
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'inp-importar') return;
  const f = ev.target.files?.[0];
  if (!f) return;
  try {
    const n = store.importar(await f.text());
    toast(`Backup restaurado: ${n} pontos`); ir('#/hoje');
  } catch (e) { toast(`Não restaurei: ${e.message}`); }
  ev.target.value = '';
});

// Cinco toques seguidos na logo ligam ou desligam o modo demonstração (gesto escondido)
document.querySelector('.marca').addEventListener('click', () => {
  if (toqueNaMarca()) { toast(modoDemo() ? 'Modo demonstração ligado' : 'Modo demonstração desligado'); render(); }
});

store.aoMudar(renderTopo);
window.addEventListener('hashchange', () => {
  if (substituindo) { substituindo = false; history.replaceState({ d: profundidade }, ''); } // trocou a entrada atual
  else if (history.state?.d != null) profundidade = history.state.d; // voltou ou avançou para uma entrada conhecida
  else { profundidade += 1; history.replaceState({ d: profundidade }, ''); }
  render();
});
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
