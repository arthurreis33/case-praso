// Painéis (seção 6.10).
//  Vendedor (uma tela, sem rolagem longa): pontos da semana × meta, funil × quartil de cima com a etapa
//  onde mais perde, retornos na janela do decisor, recompras em risco.
//  Gestor (V2.1: tela "Equipe", fora das abas, aberta pelo Perfil; em produção, papel do login): conversão por etapa e por vendedor e
//  comportamento — o painel que tenta explicar por que alguns convertem o dobro. Equipe fictícia.
import { esc, pct } from '../ui.js';
import { fmtPontos } from '../rules.js';
import { pontosSemana, meuFunil, meuComportamento, recomprasEmRisco, equipeFicticia, quartilDeCima, ETAPAS_CURTAS, meusMotivos, topMotivos, fracaoExecucao } from '../painel.js';
import { MOTIVOS_NAO_AVANCO, rotulo } from '../catalogo.js';
import { linhaCompacta } from './componentes.js';
import { linkCarteira } from './carteira.js';
import { modoDemo } from '../demo.js';

export function renderPainel({ main, store }) {
  const sem = pontosSemana(store);
  const eu = meuFunil(store);
  const top = quartilDeCima(equipeFicticia());
  const comp = meuComportamento(store);
  const risco = recomprasEmRisco(store);
  const motSemana = topMotivos(meusMotivos(store, 7)); // V2.2
  // onde mais perde: maior diferença negativa contra o quartil de cima
  let pior = null;
  eu.taxas.forEach((t, i) => { if (t == null) return; const gap = t - top.taxas[i]; if (!pior || gap < pior.gap) pior = { i, gap }; });
  const larg = (x) => `${Math.round(Math.max(0, Math.min(1, x ?? 0)) * 100)}%`;

  if (!store.meusPontos().length) {
    main.innerHTML = `<h1>Sua semana</h1><div class="vazio-box"><p><b>Ainda sem pontos na carteira.</b></p><p class="sutil">Seus números aparecem depois das primeiras visitas.</p></div>`;
    return;
  }
  main.innerHTML = `
    <h1>Sua semana</h1>
    <h2>Pontos da semana</h2>
    <div class="meta-barra" role="img" aria-label="${fmtPontos(sem.total)} de ${sem.meta} pontos"><span style="width:${larg(sem.total / sem.meta)}"></span></div>
    <p style="margin:4px 0"><b class="num">${fmtPontos(sem.total)} de ${sem.meta} pt</b> <span class="sutil">· conta na 3ª compra pelo app</span></p>
    ${sem.itens.map((x) => linhaCompacta(store, x.p, { s: `+${String(x.pontos).replace('.', ',')} pt` })).join('')}

    <h2>Seu funil × os melhores do time</h2>
    <div class="leg-comp"><span><i class="i1"></i>Você</span><span><i class="i2"></i>Os melhores (25% de cima)</span></div>
    <div class="comp" role="table" aria-label="Taxa de passagem por etapa">
      ${eu.taxas.map((t, i) => `
        <div role="rowheader" class="${pior?.i === i ? 'pior' : ''}">${esc(ETAPAS_CURTAS[i])} → ${esc(ETAPAS_CURTAS[i + 1])}</div>
        <div class="trilho" role="cell" title="Você ${pct(t)} · os melhores ${pct(top.taxas[i])}">
          <div class="lb"><span class="b voce" style="width:${larg(t)}"></span><span class="val">${pct(t)}</span></div>
          <div class="lb"><span class="b top" style="width:${larg(top.taxas[i])}"></span><span class="val">${pct(top.taxas[i])}</span></div>
        </div>`).join('')}
    </div>
    ${pior && pior.gap < -0.02 ? `<p class="insight">Onde você mais perde: <b>${esc(ETAPAS_CURTAS[pior.i])} → ${esc(ETAPAS_CURTAS[pior.i + 1])}</b>, ${Math.round(-pior.gap * 100)} pontos percentuais abaixo dos melhores.</p>` : (eu.taxas.every((t) => t == null) ? '<p class="sutil">Seu funil aparece depois das primeiras visitas.</p>' : '<p class="sutil">Você está no nível dos melhores do time em todas as etapas.</p>')}
    ${motSemana.length ? `<p class="motivos-semana">Por que não avançou (7 dias): ${motSemana.map(([k, n], i) => `${i ? '' : '<b>'}${esc(rotulo(MOTIVOS_NAO_AVANCO, k))} ${n}${i ? '' : '</b>'}`).join(' · ')}</p>` : ''}

    <div class="kpis">
      <div class="kpi"><div class="v">${pct(comp.retorno_janela)}</div><div class="r">retornos na janela do decisor${comp.n_revisitas ? ` (${comp.n_revisitas} revisitas)` : ''}</div></div>
      <a class="kpi kpi-link" href="${linkCarteira('prazo')}"><div class="v">${risco.length}</div><div class="r">recompras em risco ›</div></a>
    </div>
    ${risco.slice(0, 3).map((x) => linhaCompacta(store, x.p, { s: esc(x.texto), acao: `<a class="acao-c" href="#/ponto/${esc(x.p.id)}">Abrir</a>` })).join('')}
    ${risco.length > 3 ? `<a class="btn mais-link" href="${linkCarteira('prazo')}">Ver as ${risco.length} na Carteira</a>` : ''}`;
}

// V2.2 · rótulos curtos dos motivos para a tabela da Equipe (o rótulo inteiro vai no title e na legenda)
const MOTIVO_CURTO = { tem_fornecedor: 'Fornecedor', preco: 'Preço', quer_prazo: 'Prazo', desconfia_app: 'App', sem_tempo: 'Sem tempo', vai_pensar: 'Pensar', nao_icp: 'Não ICP', outro: 'Outro' };

export function renderGestor({ main, store }) {
  const equipe = [{ id: 'v-voce', nome: 'Você', funil: meuFunil(store), comportamento: meuComportamento(store), motivos: meusMotivos(store) }, ...equipeFicticia()];
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
  // V2.2 · motivos: a cor satura em 40% (as frações são menores que as taxas de passagem)
  const celMotivo = (t) => {
    if (t == null) return '<td class="c">–</td>';
    const i = Math.max(0, Math.min(RAMPA.length - 1, Math.floor((t / 0.4) * RAMPA.length)));
    return `<td class="c" style="background:${RAMPA[i]};color:${i >= 3 ? '#fff' : '#0b0b0b'}">${pct(t)}</td>`;
  };
  const somaMotivos = (xs) => xs.reduce((acc, x) => { for (const [k, n] of Object.entries(x.motivos || {})) acc[k] = (acc[k] || 0) + n; return acc; }, {});
  const execTopo = fracaoExecucao(somaMotivos(topo));
  const execBase = fracaoExecucao(somaMotivos(base));
  const diffs = [
    ['retorno_janela', 'dos retornos na janela do decisor', pct],
    ['voz', 'das notas por voz', pct],
    ['nucleo_s', 's para registrar a visita', (x) => num(x)],
    ['no_ponto_min', 'min por visita', (x) => num(x)],
  ];

  main.innerHTML = `
    <h1>Equipe</h1>
    ${modoDemo() ? '<p class="sim-nota">Equipe de exemplo: 5 vendedores fictícios e você.</p>' : ''}
    <h2>Conversão por etapa e por vendedor</h2>
    <p class="sutil">Quantos passam de uma etapa para a seguinte. Do que mais converte para o que menos converte.</p>
    <div class="tabela-rolagem"><table class="tabela calor">
      <thead><tr><th style="text-align:left">Vendedor</th>${ETAPAS_CURTAS.slice(0, -1).map((e, i) => `<th title="${esc(e)} → ${esc(ETAPAS_CURTAS[i + 1])}">${i + 1}→${i + 2}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${ord.map((v) => `<tr><td class="nome-v">${esc(v.nome)}</td>${v.funil.taxas.map(cel).join('')}${cel(v.funil.total)}</tr>`).join('')}</tbody>
    </table></div>
    <p class="dica">1 Planejada · 2 Visitada · 3 Decisor · 4 Cadastro · 5 1ª compra · 6 3ª compra pelo app</p>

    <h2>Comportamento</h2>
    ${razao ? `<p class="insight">Os 2 de cima (${esc(topo.map((x) => x.nome).join(', '))}) convertem <b>${num(razao, 1)}×</b> os 2 de baixo. O que fazem diferente:</p>` : ''}
    <ul style="padding-left:20px;margin:6px 0">${diffs.map(([k, txt, f]) => `<li><b>${f(med(topo, k))}</b> ${txt} contra <b>${f(med(base, k))}</b></li>`).join('')}</ul>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Vendedor</th><th class="n">Hora média</th><th class="n">Min no ponto</th><th class="n">Retorno na janela</th><th class="n">Nota por voz</th><th class="n">Registro (s)</th><th class="n">Registrou antes de sair</th></tr></thead>
      <tbody>${ord.map((v) => { const c = v.comportamento; return `<tr><td class="nome-v">${esc(v.nome)}</td><td class="n">${hora(c.hora_media)}</td><td class="n">${num(c.no_ponto_min)}</td><td class="n">${pct(c.retorno_janela)}</td><td class="n">${pct(c.voz)}</td><td class="n">${num(c.nucleo_s)}</td><td class="n">${pct(c.no_ponto_pct)}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <p class="dica">Retorno na janela: voltou até 1 h do horário combinado ou quando o decisor costuma estar.</p>

    <h2>Por que não avançou</h2>
    <p class="sutil">Motivos marcados quando o decisor não cadastrou ou recusou: a etapa de decisor para cadastro.</p>
    ${execTopo != null && execBase != null ? `<p class="insight">Nos 2 de baixo, <b>${pct(execBase)}</b> das perdas são "sem tempo", "vai pensar" ou "desconfia de app", contra <b>${pct(execTopo)}</b> nos 2 de cima. São motivos que a hora e o jeito da visita mudam.</p>` : ''}
    <div class="tabela-rolagem"><table class="tabela calor">
      <thead><tr><th style="text-align:left">Vendedor</th>${MOTIVOS_NAO_AVANCO.map(([k, r]) => `<th title="${esc(r)}">${esc(MOTIVO_CURTO[k] || r)}</th>`).join('')}<th class="n">Perdas</th></tr></thead>
      <tbody>${ord.map((v) => { const m = v.motivos || {}; const tot = Object.values(m).reduce((s, x) => s + x, 0); return `<tr><td class="nome-v">${esc(v.nome)}</td>${MOTIVOS_NAO_AVANCO.map(([k]) => celMotivo(tot ? (m[k] || 0) / tot : null)).join('')}<td class="n">${tot}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <p class="dica">Fração das perdas de cada vendedor por motivo. Fornecedor = já tem fornecedor · App = desconfia de app · Pensar = vai pensar.</p>`;
}
