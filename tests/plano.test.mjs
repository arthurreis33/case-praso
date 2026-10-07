// V2.3 · B: cliente em ativação sai da rota sugerida (vai por mensagem), salvo quando a mensagem não gerou pedido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore } from '../public/js/store.js';
import { gerarPlano } from '../public/js/plano.js';
import { CONFIG } from '../public/js/config.js';
import { DIA_MS } from '../public/js/estados.js';

const AGORA = new Date(2026, 9, 6, 9); // terça, 9h
const iso = (ms) => new Date(ms).toISOString();
const perto = (i) => ({ lat: -8.1003 + i * 0.002, lng: -34.8968 });

async function cenario() {
  let t = AGORA.getTime();
  const s = await criarStore({ agora: () => new Date(t) }).carregar();
  const ponto = (nome, i, extra = {}) => s.novoPonto({ nome_fantasia: nome, tipo: 'lanchonete', cnpj: `1234567800010${i}`, mei: false, coord_cadastral: perto(i), ...extra });
  // ativação com recompra vencendo: 1ª compra há 38 dias (faltam 7 para os 45)
  const ativacao = (nome, i) => {
    const p = ponto(nome, i, { cadastro_em: iso(t - 40 * DIA_MS) });
    s.eventoPedido(p.id, { autonomo: false, data: iso(t - 38 * DIA_MS), itens: [{ sku: 'x', nome: 'x', categoria: 'x', qtd: 1, valor: 100 }] });
    return p;
  };
  const leads = [1, 2, 3].map((i) => ponto(`Lead ${i}`, i));
  const semContato = ativacao('Ativação sem contato', 4);
  const mensagemFalhou = ativacao('Ativação mensagem sem pedido', 5);
  const mensagemFuncionou = ativacao('Ativação mensagem com pedido', 6);
  const recente = ativacao('Ativação mensagem de ontem', 7);
  // contatos de WhatsApp: três dias atrás para dois pontos, ontem para outro
  t -= 3 * DIA_MS;
  s.registrarContato(mensagemFalhou.id, { modelo_mensagem: 'recompra' });
  s.registrarContato(mensagemFuncionou.id, { modelo_mensagem: 'recompra' });
  t += 1 * DIA_MS;
  s.eventoPedido(mensagemFuncionou.id, { autonomo: true });
  t += 1 * DIA_MS;
  s.registrarContato(recente.id, { modelo_mensagem: 'recompra' });
  t += 1 * DIA_MS;
  return { s, leads, semContato, mensagemFalhou, mensagemFuncionou, recente };
}

const ids = (pl) => pl.paradas.map((x) => x.id);

test('V2.3 · ativação fica fora da rota sugerida por padrão', async () => {
  const c = await cenario();
  const pl = gerarPlano(c.s);
  assert.equal(c.s.situacao(c.semContato.id).estado, 'ativacao');
  for (const l of c.leads) assert.ok(ids(pl).includes(l.id), 'o lead entra na rota');
  assert.ok(!ids(pl).includes(c.semContato.id), 'ativação sem contato fica fora');
  assert.ok(!ids(pl).includes(c.mensagemFuncionou.id), 'a mensagem gerou pedido: fica fora');
  assert.ok(!ids(pl).includes(c.recente.id), `contato há menos de ${CONFIG.chance.ativacao_visita.dias_sem_pedido_apos_contato} dias: fica fora`);
});

test('V2.3 · exceção: mensagem de WhatsApp sem pedido há 2 dias ou mais põe a ativação na rota, com o motivo', async () => {
  const c = await cenario();
  const pl = gerarPlano(c.s);
  const parada = pl.paradas.find((x) => x.id === c.mensagemFalhou.id);
  assert.ok(parada, 'ativação com mensagem sem pedido entra na rota');
  assert.match(parada.motivo, /mensagem sem pedido há 3 dias: vale a visita/);
});

test('V2.3 · ativação posta na rota à mão pelo vendedor continua na rota', async () => {
  const c = await cenario();
  const pl = gerarPlano(c.s, { adicionados: [c.semContato.id] });
  assert.ok(ids(pl).includes(c.semContato.id));
});
