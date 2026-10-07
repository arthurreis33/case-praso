// V2.2 · o seed tem de ser coerente com a meta da H1: registro do "Você" com mediana perto de 18 s.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarSeed } from '../public/js/seed.js';

const HOJE = new Date('2026-10-05T12:00:00-03:00');
const segundos = (v) => (Date.parse(v.nucleo.fim) - Date.parse(v.nucleo.inicio)) / 1000;

test('tempo de registro do Você: mediana perto de 18 s, 70% até 22 s, nada acima de 45 s', () => {
  const { visitas } = gerarSeed({ hoje: HOJE });
  const t = visitas.filter((v) => v.nucleo?.inicio && v.nucleo?.fim).map(segundos).sort((a, b) => a - b);
  assert.ok(t.length > 50, `poucas visitas no seed: ${t.length}`);
  const mediana = t[Math.floor(t.length / 2)];
  assert.ok(mediana >= 15 && mediana <= 21, `mediana ${mediana} s`);
  assert.ok(t[0] >= 10 && t[t.length - 1] <= 45, `faixa ${t[0]}–${t[t.length - 1]} s`);
  const ate22 = t.filter((s) => s <= 22).length / t.length;
  assert.ok(ate22 >= 0.6 && ate22 <= 0.8, `fração até 22 s: ${ate22.toFixed(2)}`);
});

test('o seed continua determinístico', () => {
  const a = gerarSeed({ hoje: HOJE }).visitas.map(segundos);
  const b = gerarSeed({ hoje: HOJE }).visitas.map(segundos);
  assert.deepEqual(a, b);
});

// ---------- V2.3 · C: os dados de exemplo contam a mesma história da tese ----------
import { criarStore } from '../public/js/store.js';
import { carregarSeed } from '../public/js/seed.js';
import { gerarPlano } from '../public/js/plano.js';
import { meuFunil, meuComportamento, equipeFicticia, quartilDeCima, ETAPAS_CURTAS } from '../public/js/painel.js';
import { renderPainel, renderGestor } from '../public/js/views/painel.js';

/** O app como o avaliador abre: seed carregado e plano do dia gerado (o plano marca as paradas como planejadas). */
async function demo(hoje = HOJE) {
  const s = await criarStore({ agora: () => hoje }).carregar();
  carregarSeed(s);
  const pl = gerarPlano(s);
  s.setPlano(pl);
  s.marcarPlanejado(pl.paradas.map((x) => x.id));
  return { s, pl };
}
const textoDe = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

test('V2.3 · funil do Você nas faixas da tese e conversão total em 3º lugar no time', async () => {
  const { s } = await demo();
  const f = meuFunil(s);
  const faixas = [[0.85, 0.92], [0.55, 0.60], [0.65, 0.72], [0.70, 0.76], [0.62, 0.68]];
  f.taxas.forEach((t, i) => assert.ok(t >= faixas[i][0] && t <= faixas[i][1], `${ETAPAS_CURTAS[i]} → ${ETAPAS_CURTAS[i + 1]}: ${t.toFixed(3)}`));
  const totais = equipeFicticia().map((v) => v.funil.total).sort((a, b) => b - a);
  assert.ok(f.total < totais[1] && f.total > totais[2], `total ${f.total.toFixed(3)}`);
});

test('V2.3 · Semana: "Onde você mais perde" é Visitada → Decisor, 10 p.p. ou mais abaixo do quartil de cima', async () => {
  const { s } = await demo();
  const top = quartilDeCima(equipeFicticia());
  const f = meuFunil(s);
  assert.ok(top.taxas[1] - f.taxas[1] >= 0.10, `gap ${(top.taxas[1] - f.taxas[1]).toFixed(3)}`);
  const main = { innerHTML: '' };
  renderPainel({ main, store: s });
  assert.match(textoDe(main.innerHTML), /Onde você mais perde: Visitada → Decisor, \d+ pontos percentuais abaixo dos melhores/);
});

test('V2.3 · Carteira: a pior passagem do funil é Visitado → Decisor encontrado', async () => {
  const { s } = await demo();
  // mesma conta de views/carteira.js (desenharFunil)
  const ps = s.meusPontos();
  const alcancou = (n) => ps.filter((p) => (p.etapa_funil || 0) >= n).length;
  let pior = null;
  for (let n = 1; n < 6; n++) { const a = alcancou(n), b = alcancou(n + 1); if (a >= 5) { const t = b / a; if (!pior || t < pior.t) pior = { n, t }; } }
  assert.equal(pior.n, 2, `pior passagem ${pior.n} → ${pior.n + 1}`);
});

test('V2.3 · Visão do gestor: os de cima são 2 nomes, sem o Você, e o texto bate com a quantidade', async () => {
  const { s } = await demo();
  const main = { innerHTML: '' };
  renderGestor({ main, store: s });
  const n = Math.round((equipeFicticia().length + 1) / 4);
  const m = textoDe(main.innerHTML).match(/Os (\d+) de cima \(([^)]*)\) convertem .*? os (\d+) de baixo/);
  assert.ok(m, 'insight do comportamento');
  const nomes = m[2].split(', ');
  assert.equal(nomes.length, n, `topo: ${m[2]}`);
  assert.equal(Number(m[1]), nomes.length);
  assert.ok(!nomes.includes('Você'), `o Você está entre os de cima: ${m[2]}`);
  assert.match(textoDe(main.innerHTML), new RegExp(`Nos 2 de baixo, .* nos ${n} de cima`));
});

test('V2.3 · retornos na janela do Você abaixo de 65% e abaixo dos de Vendedor B e Vendedor C', async () => {
  const { s } = await demo();
  const eu = meuComportamento(s).retorno_janela;
  const eq = Object.fromEntries(equipeFicticia().map((v) => [v.nome, v.comportamento.retorno_janela]));
  assert.ok(eu < 0.65, `Você ${eu}`);
  assert.ok(eu < eq['Vendedor B'] && eu < eq['Vendedor C'], `Você ${eu} · B ${eq['Vendedor B']} · C ${eq['Vendedor C']}`);
});

test('V2.3 · A: nenhuma parada do Hoje tem retorno combinado fora da janela do decisor do mesmo card', async () => {
  for (const h of [8, 11, 15, 21]) {
    const hoje = new Date(HOJE); hoje.setHours(h, 0, 0, 0);
    const { pl } = await demo(hoje);
    for (const x of pl.paradas) {
      const r = x.motivo.match(/retorno combinado às (\d\d):(\d\d)/);
      const j = x.motivo.match(/decisor costuma estar das (\d+)h(\d*) às (\d+)h(\d*)/);
      if (!r || !j) continue;
      const m = Number(r[1]) * 60 + Number(r[2]);
      const a = Number(j[1]) * 60 + Number(j[2] || 0), b = Number(j[3]) * 60 + Number(j[4] || 0);
      assert.ok(m >= a && m < b, `${h}h · ${x.motivo}`);
    }
  }
});

test('V2.3 · B: na rota de exemplo, ativação só entra pela exceção da mensagem sem pedido', async () => {
  const { s, pl } = await demo();
  const ativ = pl.paradas.filter((x) => s.situacao(x.id).estado === 'ativacao');
  assert.ok(ativ.length >= 1, 'a exceção aparece na rota de exemplo');
  for (const x of ativ) assert.match(x.motivo, /mensagem sem pedido há \d+ dias: vale a visita/);
});

test('V2.3 · seed: 210 pontos fictícios em Boa Viagem, Pina e Imbiribeira', () => {
  const { pontos } = gerarSeed({ hoje: HOJE });
  assert.equal(pontos.length, 210);
  assert.ok(pontos.every((p) => p.ficticio && ['Boa Viagem', 'Pina', 'Imbiribeira'].includes(p.bairro)));
});
