// Entrada do app: store, roteador por hash (o "voltar" do Android funciona), avisos e export.
import { criarStore } from './store.js';
import { paraJSON, paraCSV, nomeArquivo, baixar, compartilhar } from './export.js';
import { esc, toast, quando } from './ui.js';
import { renderLista } from './views/lista.js';
import { renderForm, renderPonto } from './views/ponto.js';
import { renderVisita } from './views/visita.js';
import { carregarExemplo } from './seed.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('__teste__'); } catch { storage = null; }
const store = criarStore({ storage }).carregar();
window.__store = store; // depuração no console

// Pede ao navegador para não apagar os dados sob pressão de espaço.
navigator.storage?.persist?.().catch(() => {});

const barra = document.getElementById('barra');
const avisos = document.getElementById('avisos');
const dot = document.getElementById('aviso-armazenamento');
let limpar = null;

function ir(hash, substituir = false) {
  if (location.hash === hash) return render();
  if (substituir) { location.replace(hash); } else { location.hash = hash; }
}

function render() {
  if (typeof limpar === 'function') limpar();
  limpar = null;
  barra.innerHTML = '';
  barra.onclick = null;
  const h = location.hash || '#/';
  let m;
  // <main> é recriado a cada tela para soltar os listeners da anterior
  const antigo = document.getElementById('app');
  const novo = antigo.cloneNode(false);
  antigo.replaceWith(novo);
  const ctx = { main: novo, barra, store, ir };
  if ((m = h.match(/^#\/visita\/([\w-]+)$/))) limpar = renderVisita(ctx, m[1]);
  else if ((m = h.match(/^#\/ponto\/([\w-]+)\/editar$/))) renderForm(ctx, { id: m[1] });
  else if ((m = h.match(/^#\/ponto\/([\w-]+)$/))) renderPonto(ctx, m[1]);
  else if (h === '#/novo/gps') renderForm(ctx, { gps: true });
  else if (h === '#/novo') renderForm(ctx, {});
  else renderLista(ctx);
  renderAvisos();
  window.scrollTo(0, 0);
}

function renderAvisos() {
  const h = location.hash || '#/';
  const partes = [];
  if (store.erro) partes.push(`<div class="aviso erro">${esc(store.erro)}</div>`);
  const aberta = store.visitaAberta();
  if (aberta && !h.startsWith(`#/visita/${aberta.id}`)) {
    const p = store.ponto(aberta.ponto_id);
    partes.push(`<div class="aviso alerta">Visita aberta em ${esc(p?.nome || '?')} · <a href="#/visita/${aberta.id}">continuar</a></div>`);
  }
  if (h === '#/' || h === '') {
    const desde = store.estado.ultimo_export;
    const n = store.estado.visitas.filter((v) => !desde || v.checkin.em > desde).length;
    if (n) partes.push(`<div class="aviso alerta">${n} visita${n > 1 ? 's' : ''} desde o último export · <button type="button" data-acao="abrir-export" style="background:none;border:0;padding:0;font:inherit;text-decoration:underline">exportar</button></div>`);
  }
  avisos.innerHTML = partes.join('');
  dot.classList.toggle('mem', store.emMemoria || !!store.erro);
  dot.title = store.emMemoria ? 'só em memória' : 'salvo no aparelho';
}

// ---------------- Export ----------------
const dlg = document.getElementById('dlg-export');
function abrirExport() {
  const e = store.estado;
  document.getElementById('export-resumo').textContent =
    `${e.pontos.length} pontos · ${e.visitas.length} visitas · último export: ${e.ultimo_export ? quando(e.ultimo_export) : 'nunca'}`;
  const arquivoTeste = typeof File === 'function' ? new File(['x'], 't.json', { type: 'application/json' }) : null;
  document.getElementById('btn-compartilhar').hidden = !(arquivoTeste && navigator.canShare?.({ files: [arquivoTeste] }));
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

document.addEventListener('click', async (ev) => {
  const acao = ev.target.closest('[data-acao]')?.dataset.acao;
  if (!acao) return;
  try {
    if (acao === 'abrir-export') abrirExport();
    else if (acao === 'baixar-csv') {
      baixar(paraCSV(store.estado), nomeArquivo('csv'), 'text/csv;charset=utf-8');
      store.marcarExport(); toast('CSV baixado'); renderAvisos();
    } else if (acao === 'baixar-json') {
      baixar(paraJSON(store.estado), nomeArquivo('json'), 'application/json');
      store.marcarExport(); toast('JSON baixado'); renderAvisos();
    } else if (acao === 'compartilhar-json') {
      if (await compartilhar(paraJSON(store.estado), nomeArquivo('json'), 'application/json')) { store.marcarExport(); renderAvisos(); }
    } else if (acao === 'carregar-exemplo') {
      const n = carregarExemplo(store); dlg.close(); toast(`${n} pontos fictícios carregados`); ir('#/');
    } else if (acao === 'remover-exemplo') {
      store.removerFicticios(); dlg.close(); toast('Pontos fictícios removidos'); ir('#/');
    }
  } catch (e) {
    toast(`Erro: ${e.message}`);
  }
});

document.getElementById('inp-importar').addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  if (!f) return;
  try {
    store.importar(await f.text());
    dlg.close(); toast('Backup importado'); ir('#/');
  } catch (e) { toast(`Não importei: ${e.message}`); }
  ev.target.value = '';
});

store.aoMudar(() => { dot.classList.toggle('mem', store.emMemoria || !!store.erro); });
window.addEventListener('hashchange', render);
// ao voltar para a aba (ex.: depois do Maps), relê a tela para atualizar horários
document.addEventListener('visibilitychange', () => { if (!document.hidden && !location.hash.startsWith('#/visita/') && !location.hash.includes('novo') && !location.hash.includes('editar')) render(); });
render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
