// Painéis (seção 6.10).
//  Vendedor (uma tela, sem rolagem longa): pontos da semana × meta, funil × quartil de cima com a etapa
//  onde mais perde, retornos na janela do decisor, recompras em risco.
//  Gestor (rota separada, seletor "visão gestor", sem login): conversão por etapa e por vendedor e
//  comportamento — o painel que tenta explicar por que alguns convertem o dobro. Equipe fictícia.
import { esc, pct } from '../ui.js';
import { fmtPontos } from '../rules.js';
import { pontosSemana, meuFunil, meuComportamento, recomprasEmRisco, equipeFicticia, quartilDeCima, ETAPAS_CURTAS } from '../painel.js';
import { linhaCompacta } from './componentes.js';
import { linkCarteira } from './carteira.js';

const seletor = (atual) => `<div class="modo" role="group" aria-label="Visão">
  <button type="button" data-visao="painel" aria-pressed="${atual === 'painel'}">Vendedor</button>
  <button type="button" data-visao="gestor" aria-pressed="${atual === 'gestor'}">Visão gestor</button></div>`;

function ligarSeletor(main, ir) {
  main.addEventListener('click', (ev) => { const v = ev.target.closest('[data-visao]')?.dataset.visao; if (v) ir(`#/${v}`); });
}

export function renderPainel({ main, store, ir }) {
  const sem = pontosSemana(store);
  const eu = meuFunil(store);
  const top = quartilDeCima(equipeFicticia());
  const comp = meuComportamento(store);
  const risco = recomprasEmRisco(store);
  // onde mais perde: maior diferença negativa contra o quartil de cima
  let pior = null;
  eu.taxas.forEach((t, i) => { if (t == null) return; const gap = t - top.taxas[i]; if (!pior || gap < pior.gap) pior = { i, gap }; });
  const larg = (x) => `${Math.round(Math.max(0, Math.min(1, x ?? 0)) * 100)}%`;

  main.innerHTML = `
    ${seletor('painel')}
    <h2 style="margin-top:4px">Pontos da semana</h2>
    <div class="meta-barra" role="img" aria-label="${fmtPontos(sem.total)} de ${sem.meta} pontos"><span style="width:${larg(sem.total / sem.meta)}"></span></div>
    <p style="margin:4px 0"><b class="num">${fmtPontos(sem.total)} de ${sem.meta} pt</b> <span class="sutil">· conta quando o ponto vira recorrente (3ª compra autônoma)</span></p>
    ${sem.itens.map((x) => linhaCompacta(store, x.p, { s: `+${String(x.pontos).replace('.', ',')} pt` })).join('')}

    <h2>Seu funil × quartil de cima</h2>
    <div class="leg-comp"><span><i class="i1"></i>Você</span><span><i class="i2"></i>Quartil de cima (${esc(top.nomes.join(', '))})</span></div>
    <div class="comp" role="table" aria-label="Taxa de passagem por etapa">
      ${eu.taxas.map((t, i) => `
        <div role="rowheader" class="${pior?.i === i ? 'pior' : ''}">${esc(ETAPAS_CURTAS[i])} → ${esc(ETAPAS_CURTAS[i + 1])}</div>
        <div class="trilho" role="cell" title="Você ${pct(t)} · quartil de cima ${pct(top.taxas[i])}">
          <div class="lb"><span class="b voce" style="width:${larg(t)}"></span><span class="val">${pct(t)}</span></div>
          <div class="lb"><span class="b top" style="width:${larg(top.taxas[i])}"></span><span class="val">${pct(top.taxas[i])}</span></div>
        </div>`).join('')}
    </div>
    ${pior && pior.gap < -0.02 ? `<p class="insight">Onde você mais perde: <b>${esc(ETAPAS_CURTAS[pior.i])} → ${esc(ETAPAS_CURTAS[pior.i + 1])}</b>, ${Math.round(-pior.gap * 100)} pontos percentuais abaixo do quartil de cima.</p>` : '<p class="sutil">Você está no nível do quartil de cima em todas as etapas.</p>'}

    <div class="kpis">
      <div class="kpi"><div class="v">${pct(comp.retorno_janela)}</div><div class="r">retornos na janela do decisor${comp.n_revisitas ? ` (${comp.n_revisitas} revisitas)` : ''}</div></div>
      <a class="kpi kpi-link" href="${linkCarteira('prazo')}"><div class="v">${risco.length}</div><div class="r">recompras em risco ›</div></a>
    </div>
    ${risco.slice(0, 3).map((x) => linhaCompacta(store, x.p, { s: esc(x.texto), acao: `<a class="acao-c" href="#/ponto/${esc(x.p.id)}">Abrir</a>` })).join('')}
    ${risco.length > 3 ? `<a class="btn mais-link" href="${linkCarteira('prazo')}">Ver as ${risco.length} na Carteira</a>` : ''}`;
  ligarSeletor(main, ir);
}

export function renderGestor({ main, store, ir }) {
  const equipe = [{ id: 'v-voce', nome: 'Você', funil: meuFunil(store), comportamento: meuComportamento(store) }, ...equipeFicticia()];
  const ord = [...equipe].sort((a, b) => (b.funil.total ?? 0) - (a.funil.total ?? 0));
  const n = Math.max(1, Math.round(ord.length / 4));
  const topo = ord.slice(0, n + 1); // os 2 melhores
  const base = ord.slice(-2); // os 2 piores
  const med = (xs, k) => xs.reduce((s, x) => s + (x.comportamento[k] ?? 0), 0) / xs.length;
  // escala sequencial de um tom (azul) para a taxa de passagem
  const RAMPA = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
  const cel = (t) => {
    if (t == null) return '<td class="c">–</td>';
    const i = Math.max(0, Math.min(RAMPA.length - 1, Math.floor(t * RAMPA.length)));
    return `<td class="c" style="background:${RAMPA[i]};color:${i >= 3 ? '#fff' : '#0b0b0b'}">${pct(t)}</td>`;
  };
  const hora = (h) => (h == null ? '–' : `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);
  const num = (x, d = 0) => (x == null ? '–' : x.toFixed(d).replace('.', ','));
  const razao = topo.length && base.length ? (med(topo.map((x) => ({ comportamento: { t: x.funil.total } })), 't') / Math.max(0.001, med(base.map((x) => ({ comportamento: { t: x.funil.total } })), 't'))) : null;
  const diffs = [
    ['retorno_janela', 'dos retornos na janela do decisor', pct],
    ['voz', 'das notas por voz', pct],
    ['nucleo_s', 's de registro (núcleo)', (x) => num(x)],
    ['no_ponto_min', 'min por visita', (x) => num(x)],
  ];

  main.innerHTML = `
    ${seletor('gestor')}
    <p class="sim-nota">Visão do gestor sem login, com 5 vendedores fictícios mais "Você" (dados do aparelho).</p>
    <h2>Conversão por etapa e por vendedor</h2>
    <p class="sutil">Taxa de passagem de cada etapa para a seguinte. Ordenado pela conversão total (planejada → 3ª compra autônoma).</p>
    <div class="tabela-rolagem"><table class="tabela calor">
      <thead><tr><th style="text-align:left">Vendedor</th>${ETAPAS_CURTAS.slice(0, -1).map((e, i) => `<th title="${esc(e)} → ${esc(ETAPAS_CURTAS[i + 1])}">${i + 1}→${i + 2}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${ord.map((v) => `<tr><td class="nome-v">${esc(v.nome)}</td>${v.funil.taxas.map(cel).join('')}${cel(v.funil.total)}</tr>`).join('')}</tbody>
    </table></div>
    <p class="dica">1 Planejada · 2 Efetiva · 3 Decisor · 4 Cadastro · 5 1ª compra · 6 3ª autônoma. Tom mais escuro = maior taxa; o número está sempre na célula.</p>

    <h2>Comportamento</h2>
    ${razao ? `<p class="insight">Os 2 de cima (${esc(topo.map((x) => x.nome).join(', '))}) convertem <b>${num(razao, 1)}×</b> os 2 de baixo. O que fazem diferente:</p>` : ''}
    <ul style="padding-left:20px;margin:6px 0">${diffs.map(([k, txt, f]) => `<li><b>${f(med(topo, k))}</b> ${txt} contra <b>${f(med(base, k))}</b></li>`).join('')}</ul>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Vendedor</th><th class="n">Hora média</th><th class="n">Min no ponto</th><th class="n">Retorno na janela</th><th class="n">Nota por voz</th><th class="n">Núcleo (s)</th><th class="n">Registro no ponto</th></tr></thead>
      <tbody>${ord.map((v) => { const c = v.comportamento; return `<tr><td class="nome-v">${esc(v.nome)}</td><td class="n">${hora(c.hora_media)}</td><td class="n">${num(c.no_ponto_min)}</td><td class="n">${pct(c.retorno_janela)}</td><td class="n">${pct(c.voz)}</td><td class="n">${num(c.nucleo_s)}</td><td class="n">${pct(c.no_ponto_pct)}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <p class="dica">"Registro no ponto" = núcleo salvo antes do check-out (teste de H1). "Retorno na janela" = revisita até 60 min do horário sugerido ou dentro da janela do decisor.</p>`;
  ligarSeletor(main, ir);
}
