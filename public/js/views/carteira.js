// Carteira (seção 6.5): uma tela, dois modos.
//  Funil: etapas empilhadas na vertical, com contagem e taxa de passagem; tocar expande os cards.
//         Os cards só se movem por evento (visita, cadastro, pedido, tempo) e mostram o selo "avançou".
//  Lista: busca por nome ou CNPJ, filtros e ordenação.
import { ETAPAS, ESTADOS, TIPOS, rotulo } from '../catalogo.js';
import { esc, pct } from '../ui.js';
import { cardPonto } from './componentes.js';
import { avaliarPrioridade } from '../prioridade.js';
import { pontosValor, coordDe, distanciaM } from '../rules.js';
import { nomeDe } from '../store.js';
import { DIA_MS } from '../estados.js';

// estado da tela (sobrevive à troca de aba nesta sessão)
const ui = {
  modo: 'funil', aberta: null, busca: '', estados: new Set(), tipos: new Set(), pontos: null,
  semVisita: false, prazo: false, retornar: false, verificar: false, semPino: false, ordem: 'esperados', limite: 40,
};
const LIMPO = () => ({ busca: '', estados: new Set(), tipos: new Set(), pontos: null, semVisita: false, prazo: false, retornar: false, verificar: false, semPino: false });

/** Link de outra tela para a Lista já filtrada: #/carteira?filtro=prazo|retornar|verificar|sem_visita|estado:churn */
export const linkCarteira = (filtro) => `#/carteira?filtro=${encodeURIComponent(filtro)}`;
const N_SEM_VISITA = 14;

export function renderCarteira({ main, barra, store, render, params }) {
  // Chegou por um link filtrado: abre a Lista só com esse filtro e limpa o endereço (o filtro vale uma vez)
  if (params.filtro) {
    Object.assign(ui, LIMPO(), { modo: 'lista', limite: 40 });
    const [f, v] = params.filtro.split(':');
    if (f === 'estado' && v) ui.estados.add(v);
    else if (f === 'prazo') ui.prazo = true;
    else if (f === 'retornar') ui.retornar = true;
    else if (f === 'verificar') ui.verificar = true;
    else if (f === 'sem_pino') ui.semPino = true;
    else if (f === 'sem_visita') ui.semVisita = true;
    history.replaceState(history.state, '', '#/carteira');
  }
  const ps = store.meusPontos();
  if (!ps.length) {
    main.innerHTML = `<h1>Carteira</h1>
      <div class="vazio-box"><p><b>Sua carteira está vazia.</b></p><p class="sutil">Cadastre o ponto onde você está ou busque pelo CNPJ.</p></div>`;
    barra.innerHTML = '<a class="btn primaria grande" href="#/novo/gps">+ Ponto aqui</a><a class="btn grande" href="#/novo">+ Adicionar</a>';
    return;
  }
  const sits = new Map(ps.map((p) => [p.id, store.situacao(p.id)]));

  main.innerHTML = `
    <h1>Carteira <span class="sutil num">· ${ps.length} pontos</span></h1>
    <div class="modo" role="group" aria-label="Modo">
      <button type="button" data-modo="funil" aria-pressed="${ui.modo === 'funil'}">Funil</button>
      <button type="button" data-modo="lista" aria-pressed="${ui.modo === 'lista'}">Lista</button>
    </div>
    <div id="conteudo"></div>`;
  const cont = main.querySelector('#conteudo');

  barra.innerHTML = `<a class="btn primaria grande" href="#/novo/gps">+ Ponto aqui</a><a class="btn grande" href="#/novo">+ Adicionar</a>`;

  if (ui.modo === 'funil') desenharFunil(); else desenharLista();

  main.addEventListener('click', (ev) => {
    const m = ev.target.closest('[data-modo]')?.dataset.modo;
    if (m) { ui.modo = m; return render(); }
    const et = ev.target.closest('[data-etapa]');
    if (et) { const n = +et.dataset.etapa; ui.aberta = ui.aberta === n ? null : n; ui.limite = 40; return desenharFunil(); }
    const f = ev.target.closest('[data-filtro]');
    if (f) { alternarFiltro(f.dataset.filtro, f.dataset.v); return desenharLista(); }
    const o = ev.target.closest('[data-ordem]')?.dataset.ordem;
    if (o) { ui.ordem = o; return desenharLista(); }
    if (ev.target.closest('[data-mais]')) { ui.limite += 40; return ui.modo === 'funil' ? desenharFunil() : desenharLista(); }
    if (ev.target.closest('[data-limpar]')) { Object.assign(ui, LIMPO()); return desenharLista(); }
  });

  // ---------------- Funil ----------------
  function desenharFunil() {
    const porEtapa = new Map(ETAPAS.map(([n]) => [n, []]));
    const fora = [];
    for (const p of ps) { const e = p.etapa_funil || 0; (e ? porEtapa.get(e) : fora).push(p); }
    const alcancou = (n) => ps.filter((p) => (p.etapa_funil || 0) >= n).length;
    const max = Math.max(1, ...ETAPAS.map(([n]) => alcancou(n)));
    // pior passagem: onde mais se perde
    let pior = null;
    for (let n = 1; n < 6; n++) {
      const a = alcancou(n), b = alcancou(n + 1);
      if (a >= 5) { const t = b / a; if (!pior || t < pior.t) pior = { n, t }; }
    }
    const recentes = ps.filter((p) => store.avancos.has(p.id) && Date.now() - store.avancos.get(p.id).ts < 8000);

    cont.innerHTML = `
      ${recentes.length ? `<div class="caixa destaque"><b>Acabaram de mudar</b>${recentes.map((p) => cardPonto(store, p)).join('')}</div>` : ''}
      ${ETAPAS.map(([n, nome], i) => {
        const lista = porEtapa.get(n);
        const a = alcancou(n);
        const prox = i < 5 ? alcancou(n + 1) : null;
        const aberta = ui.aberta === n;
        return `
        <div class="etapa">
          <button type="button" data-etapa="${n}" aria-expanded="${aberta}">
            <span class="n">${n}</span>
            <span><span class="nome-etapa">${esc(nome)}</span>
              <span class="barra-etapa" aria-hidden="true"><span style="width:${Math.round((a / max) * 100)}%"></span></span>
              <span class="sutil" style="font-size:.8rem">${a} chegaram até aqui</span></span>
            <span class="qtd" aria-label="${lista.length} pontos nesta etapa">${lista.length}</span>
          </button>
          ${aberta ? `<div class="cards">${ordenar(lista, 'recente').slice(0, ui.limite).map((p) => cardPonto(store, p)).join('') || '<p class="sutil">Nenhum ponto nesta etapa agora.</p>'}
            ${lista.length > ui.limite ? '<button class="btn" data-mais style="width:100%;margin-bottom:8px">Mostrar mais</button>' : ''}</div>` : ''}
        </div>
        ${prox != null ? `<div class="passagem ${pior?.n === n ? 'pior' : ''}">↓ passam <b>${pct(a ? prox / a : null)}</b>${pior?.n === n ? ' · onde mais se perde' : ''}</div>` : ''}`;
      }).join('')}
      <details class="dobra" style="margin-top:12px">
        <summary>Fora do funil agora (${fora.length})</summary>
        <p class="sutil">Ainda não entraram numa lista do dia.</p>
        ${ordenar(fora, 'esperados').slice(0, 30).map((p) => cardPonto(store, p)).join('')}
      </details>`;
  }

  // ---------------- Lista ----------------
  function alternarFiltro(f, v) {
    if (f === 'estado') ui.estados.has(v) ? ui.estados.delete(v) : ui.estados.add(v);
    if (f === 'tipo') ui.tipos.has(v) ? ui.tipos.delete(v) : ui.tipos.add(v);
    if (f === 'pontos') ui.pontos = ui.pontos === v ? null : v;
    if (f === 'sem_visita') ui.semVisita = !ui.semVisita;
    if (f === 'prazo') ui.prazo = !ui.prazo;
    if (f === 'retornar') ui.retornar = !ui.retornar;
    if (f === 'verificar') ui.verificar = !ui.verificar;
    if (f === 'sem_pino') ui.semPino = !ui.semPino;
    ui.limite = 40;
  }

  function filtrar() {
    const q = ui.busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const agora = store.agora();
    return ps.filter((p) => {
      const s = sits.get(p.id);
      if (q && !(nomeDe(p).toLowerCase().includes(q) || (p.razao_social || '').toLowerCase().includes(q) || (qd.length >= 3 && (p.cnpj || '').includes(qd)))) return false;
      if (ui.estados.size && !ui.estados.has(s.estado)) return false;
      if (ui.tipos.size && !ui.tipos.has(p.tipo)) return false;
      if (ui.pontos && String(pontosValor(p)) !== ui.pontos) return false;
      if (ui.semVisita) {
        const u = store.visitasDo(p.id)[0];
        if (u && (agora - new Date(u.checkin.em)) / DIA_MS <= N_SEM_VISITA) return false;
      }
      if (ui.prazo && !prazoVencendo(s)) return false;
      if (ui.retornar && !(p.status_dia === 'retornar' && p.retorno_sugerido)) return false;
      if (ui.verificar && !(p.verificar || !p.cnpj)) return false;
      if (ui.semPino && coordDe(p)) return false;
      return true;
    });
  }

  function ordenar(lista, ordem) {
    const base = store.vendedor()?.base;
    const chave = {
      esperados: (p) => -avaliarPrioridade(store, p, { sit: sits.get(p.id) }).esperados,
      distancia: (p) => { const c = coordDe(p); return c && base ? distanciaM(base.lat, base.lng, c.lat, c.lng) : 1e9; },
      prazo: (p) => diasAtePrazo(sits.get(p.id)),
      recente: (p) => -(store.avancos.get(p.id)?.ts || new Date(p.etapa_desde || p.atualizado_em || 0).getTime()),
    }[ordem];
    return lista.map((p) => [p, chave(p)]).sort((a, b) => a[1] - b[1]).map(([p]) => p);
  }

  function desenharLista() {
    const res = ordenar(filtrar(), ui.ordem);
    const chip = (f, v, r, on) => `<button type="button" class="chip" data-filtro="${f}" data-v="${esc(v)}" aria-pressed="${on}">${esc(r)}</button>`;
    cont.innerHTML = `
      <input type="search" id="busca" placeholder="Buscar por nome ou CNPJ" value="${esc(ui.busca)}" aria-label="Buscar por nome ou CNPJ" enterkeyhint="search">
      <div class="chips rolagem" aria-label="Filtrar por estado">${ESTADOS.map(([v, r]) => chip('estado', v, r, ui.estados.has(v))).join('')}</div>
      <div class="chips rolagem" aria-label="Filtrar por tipo">${TIPOS.map(([v, r]) => chip('tipo', v, r, ui.tipos.has(v))).join('')}</div>
      <div class="chips rolagem" aria-label="Outros filtros">
        ${chip('pontos', '3', '3 pt', ui.pontos === '3')}${chip('pontos', '1', '1 pt', ui.pontos === '1')}${chip('pontos', '0.5', '0,5 pt', ui.pontos === '0.5')}
        ${chip('sem_visita', '1', `Sem visita há +${N_SEM_VISITA} d`, ui.semVisita)}${chip('prazo', '1', 'Prazo vencendo', ui.prazo)}${chip('retornar', '1', 'Retorno marcado', ui.retornar)}${chip('verificar', '1', 'Sem CNPJ', ui.verificar)}${chip('sem_pino', '1', 'Sem localização', ui.semPino)}
      </div>
      <div class="secao-titulo"><span class="sutil" id="n-res">${res.length} pontos</span>
        <label class="sutil">Ordenar <select id="ordem" style="min-height:48px;width:auto;padding:4px 8px">
          <option value="esperados"${ui.ordem === 'esperados' ? ' selected' : ''}>pontos esperados</option>
          <option value="distancia"${ui.ordem === 'distancia' ? ' selected' : ''}>distância da base</option>
          <option value="prazo"${ui.ordem === 'prazo' ? ' selected' : ''}>dias até o prazo</option>
        </select></label></div>
      <div id="res">${res.slice(0, ui.limite).map((p) => cardPonto(store, p, { esperados: ui.ordem === 'esperados' ? avaliarPrioridade(store, p, { sit: sits.get(p.id) }).esperados : null })).join('')
        || '<p class="vazio">Nada com esses filtros. <button class="link-btn" data-limpar>Limpar filtros</button></p>'}
      ${res.length > ui.limite ? '<button class="btn" data-mais style="width:100%">Mostrar mais</button>' : ''}</div>`;
    const inp = cont.querySelector('#busca');
    inp.addEventListener('input', () => {
      ui.busca = inp.value;
      clearTimeout(inp._t);
      inp._t = setTimeout(() => { const pos = inp.selectionStart; desenharLista(); const n = cont.querySelector('#busca'); n.focus(); n.setSelectionRange(pos, pos); }, 180);
    });
    cont.querySelector('#ordem').addEventListener('change', (e) => { ui.ordem = e.target.value; desenharLista(); });
  }
}

export function prazoVencendo(s) {
  if (s.estado === 'ativacao') return s.prazo.dias_restantes <= 10;
  if (['recorrente', 'ativacao_vencida'].includes(s.estado) && s.prazo) return s.prazo.dias_para_churn <= 30;
  return false;
}

function diasAtePrazo(s) {
  if (s.estado === 'ativacao') return s.prazo.dias_restantes;
  if (s.prazo?.dias_para_churn != null && s.estado !== 'churn') return s.prazo.dias_para_churn;
  return 1e6;
}

