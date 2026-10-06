// V2.2 · B3: do cadastro ao primeiro pedido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore } from '../public/js/store.js';
import { avaliarPrioridade } from '../public/js/prioridade.js';
import { sugerirProximaAcao } from '../public/js/proxima.js';
import { destaqueAquisicao, cesta } from '../public/js/whatsapp.js';
import { CONFIG } from '../public/js/config.js';
import { DIA_MS } from '../public/js/estados.js';

const AGORA = new Date(2026, 9, 6, 9); // terça, 9h
const BASE = CONFIG.chance.base.cadastrado_sem_compra;

test('chance do cadastrado sobe logo depois do cadastro e cai depois de 30 dias, nos limites certos', async () => {
  const s = await criarStore({ agora: () => AGORA }).carregar();
  const casos = [
    [0, 1.8, /cadastrou hoje: a 1ª compra é agora/],
    [1, 1.8, /cadastrou ontem: a 1ª compra é agora/],
    [2, 1.8, /cadastrou há 2 dias: a 1ª compra é agora/],
    [3, 1.8, /cadastrou há 3 dias: a 1ª compra é agora/],
    [4, 1.3, /cadastrou há 4 dias: a 1ª compra é agora/],
    [10, 1.3, /cadastrou há 10 dias: a 1ª compra é agora/],
    [11, 1, /cadastrado há 11 dias, sem 1ª compra/],
    [30, 1, /cadastrado há 30 dias, sem 1ª compra/],
    [31, 0.6, /cadastrado há 31 dias sem compra/],
    [40, 0.6, /cadastrado há 40 dias sem compra/],
  ];
  for (const [dias, fator, texto] of casos) {
    const p = s.novoPonto({ nome_fantasia: `C${dias}`, tipo: 'bar', cadastro_em: new Date(AGORA.getTime() - dias * DIA_MS - 60000).toISOString() });
    const a = avaliarPrioridade(s, s.ponto(p.id));
    assert.equal(a.sit.estado, 'cadastrado_sem_compra');
    assert.ok(Math.abs(a.chance - BASE * fator) < 1e-9, `${dias} dias: chance ${a.chance}, esperado ${BASE * fator}`);
    assert.match(a.motivos.join(' · '), texto);
  }
});

test('cadastro na visita: próxima ação é acompanhar a 1ª compra no dia seguinte', () => {
  const v = { tipo: 'aquisicao', nucleo: { resultado: 'falou_com_decisor', faixas: [], dias: [] } };
  const semJanela = sugerirProximaAcao(v, { tipo: 'bar' }, { agora: AGORA, cadastroNaVisita: true });
  assert.equal(semJanela.tipo, 'acompanhar_1a_compra');
  assert.equal(new Date(semJanela.data_hora).getTime(), new Date(2026, 9, 7, 10).getTime());
  assert.match(semJanela.porque, /se não pediu na visita/);
  const comJanela = sugerirProximaAcao(v, { tipo: 'bar', decisor: { janela: { dias: [], faixas: ['14-17'] } } }, { agora: AGORA, cadastroNaVisita: true });
  assert.equal(new Date(comJanela.data_hora).getTime(), new Date(2026, 9, 7, 14).getTime());
});

test('o destaque da aquisição muda quando o cadastro acontece durante a visita', () => {
  const antes = destaqueAquisicao('padaria', false);
  const depois = destaqueAquisicao('padaria', true);
  assert.match(antes.titulo, /objetivo: cadastro no app, agora/);
  assert.equal(depois.titulo, 'Cadastro feito · próximo passo: 1º pedido agora, com ele.');
  assert.ok(depois.texto.includes(cesta('padaria').titulo), 'mostra a cesta de entrada do tipo');
  assert.match(depois.texto, /pedido mínimo/);
});
