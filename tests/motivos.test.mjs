// V2.2 · B2: o motivo de não avanço devolve algo (próxima ação, prioridade, painéis).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sugerirProximaAcao, motivoDaVisita } from '../public/js/proxima.js';
import { CONFIG } from '../public/js/config.js';
import { MOTIVOS_NAO_AVANCO } from '../public/js/catalogo.js';
import { criarStore } from '../public/js/store.js';
import { avaliarPrioridade } from '../public/js/prioridade.js';
import { equipeFicticia, meusMotivos, topMotivos, fracaoExecucao } from '../public/js/painel.js';

const D = (dia, h, m = 0) => new Date(2026, 9, dia, h, m); // outubro de 2026; dia 6 = terça
const AGORA = D(6, 10);
const ponto = { tipo: 'restaurante', decisor: { papel: 'dono', janela: { dias: [], faixas: ['14-17'] } } }; // abre 10h → "aberto" 11h
const visita = (resultado, motivo) => ({ tipo: 'aquisicao', nucleo: { resultado, faixas: [], dias: [] }, motivo_nao_avanco: motivo });
const sug = (resultado, motivo) => sugerirProximaAcao(visita(resultado, motivo), ponto, { agora: AGORA });

test('toda chave de MOTIVOS_NAO_AVANCO tem regra em CONFIG.motivos', () => {
  for (const [k] of MOTIVOS_NAO_AVANCO) assert.ok(k in CONFIG.motivos, `falta ${k}`);
  for (const [k, m] of Object.entries(CONFIG.motivos)) {
    assert.ok(MOTIVOS_NAO_AVANCO.some(([c]) => c === k), `${k} não está no catálogo`);
    assert.ok(m.argumento, `${k} sem argumento`);
  }
});

const casos = [
  ['tem_fornecedor', 'retorno', D(13, 14)], // 7 dias, na janela (14h)
  ['preco', 'retorno', D(9, 11)], // 3 dias, abertura + 1h
  ['quer_prazo', 'retorno', D(9, 11)],
  ['desconfia_app', 'retorno', D(9, 14)], // 3 dias, na janela
  ['sem_tempo', 'retorno', D(6, 14)], // próxima janela: hoje às 14h
  ['vai_pensar', 'retorno', D(8, 11)], // 2 dias
];
for (const [motivo, tipo, quando] of casos) {
  test(`motivo ${motivo}: a próxima ação vem de CONFIG.motivos`, () => {
    for (const resultado of ['falou_com_decisor', 'recusou']) {
      const s = sug(resultado, motivo);
      assert.equal(s.tipo, tipo);
      assert.equal(new Date(s.data_hora).getTime(), quando.getTime(), `${resultado}: ${s.data_hora}`);
      assert.equal(s.porque, CONFIG.motivos[motivo].porque);
    }
  });
}

test('motivo nao_icp: sem próxima ação', () => {
  const s = sug('recusou', 'nao_icp');
  assert.equal(s.tipo, 'nenhuma');
  assert.equal(s.data_hora, null);
  assert.match(s.porque, /não é ICP/);
});

test('motivo "outro" e sem motivo: vale a sugestão de antes', () => {
  for (const m of ['outro', null]) {
    assert.match(sug('falou_com_decisor', m).porque, /falou com o decisor sem cadastro/);
    assert.match(sug('recusou', m).porque, /recusou: a prioridade cai/);
  }
});

test('motivo só conta quando o resultado pede motivo', () => {
  assert.match(sug('aberto_sem_decisor', 'preco').porque, /decisor ausente/);
  assert.equal(motivoDaVisita(visita('aberto_sem_decisor', 'preco')), null);
  assert.deepEqual(motivoDaVisita(visita('recusou', 'preco')), { chave: 'preco', argumento: CONFIG.motivos.preco.argumento });
});

test('prioridade: "Não é ICP" zera a chance e explica; os outros motivos não mexem', async () => {
  const s = await criarStore({ agora: () => AGORA }).carregar();
  const marca = (nome, motivo) => {
    const p = s.novoPonto({ nome_fantasia: nome, tipo: 'bar' });
    const v = s.checkin(p.id);
    s.setCampo(v.id, 'nucleo.resultado', 'recusou');
    if (motivo) s.setCampo(v.id, 'motivo_nao_avanco', motivo);
    s.salvarNucleo(v.id); s.checkout(v.id);
    return avaliarPrioridade(s, s.ponto(p.id));
  };
  const semMotivo = marca('A', null);
  const icp = marca('B', 'nao_icp');
  assert.equal(icp.chance, 0);
  assert.equal(icp.esperados, 0);
  assert.equal(icp.bloqueio, 'não é ICP');
  for (const m of ['tem_fornecedor', 'preco', 'quer_prazo', 'desconfia_app', 'sem_tempo', 'vai_pensar', 'outro']) {
    assert.equal(marca(m, m).chance, semMotivo.chance, m);
  }
});

test('painéis: motivos do vendedor, os 3 mais frequentes e a equipe de exemplo determinística', async () => {
  const s = await criarStore({ agora: () => AGORA }).carregar();
  for (const m of ['preco', 'preco', 'vai_pensar', 'tem_fornecedor', 'preco', 'vai_pensar', 'sem_tempo']) {
    const p = s.novoPonto({ nome_fantasia: m, tipo: 'bar' });
    const v = s.checkin(p.id);
    s.setCampo(v.id, 'nucleo.resultado', 'falou_com_decisor'); s.setCampo(v.id, 'motivo_nao_avanco', m);
    s.salvarNucleo(v.id); s.checkout(v.id);
  }
  const cont = meusMotivos(s, 7);
  assert.deepEqual(topMotivos(cont), [['preco', 3], ['vai_pensar', 2], ['tem_fornecedor', 1]]);
  assert.equal(fracaoExecucao(cont), 3 / 7);

  const a = equipeFicticia(), b = equipeFicticia();
  assert.deepEqual(a.map((v) => v.motivos), b.map((v) => v.motivos));
  for (const v of a) {
    const tot = Object.values(v.motivos).reduce((x, y) => x + y, 0);
    assert.equal(tot, v.funil.contagens[2] - v.funil.contagens[3], v.nome);
  }
  // quem converte menos perde mais por execução
  const ord = [...a].sort((x, y) => y.funil.total - x.funil.total);
  assert.ok(fracaoExecucao(ord.at(-1).motivos) > fracaoExecucao(ord[0].motivos));
});
