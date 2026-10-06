// Transições do ciclo de vida (seção 5). Datas fixas para o teste não depender do dia em que roda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliar, calcularEtapa, tipoVisitaPara, DIA_MS } from '../public/js/estados.js';

const D0 = new Date(2026, 0, 10, 10, 0).getTime(); // 1ª compra
const dia = (n, h = 0) => new Date(D0 + n * DIA_MS + h * 3600000);
const ped = (n, autonomo = true) => ({ data: dia(n).toISOString(), autonomo });
const ponto = (extra = {}) => ({ cadastro_em: dia(-1).toISOString(), ...extra });

test('lead: nunca se cadastrou', () => {
  const r = avaliar({}, [], [], dia(0));
  assert.equal(r.estado, 'lead');
  assert.equal(r.transicoes.length, 0);
});

test('cadastro sem pedido → cadastrado_sem_compra (rótulo Oportunidade)', () => {
  const r = avaliar(ponto(), [], [], dia(0));
  assert.equal(r.estado, 'cadastrado_sem_compra');
  assert.equal(r.transicoes[0].causa, 'cadastro');
  assert.equal(r.etapa, 4);
});

test('1ª e 2ª compra → ativação, com prazo dos 45 dias', () => {
  const r = avaliar(ponto(), [ped(0, false), ped(10)], [], dia(33));
  assert.equal(r.estado, 'ativacao');
  assert.equal(r.compras_ciclo, 2);
  assert.equal(r.prazo.dias_restantes, 12);
  assert.equal(r.prazo.texto, 'faltam 12 dias para a 3ª compra');
  assert.equal(r.etapa, 5);
});

test('3ª compra autônoma dentro dos 45 dias → recorrente', () => {
  const r = avaliar(ponto(), [ped(0, false), ped(10), ped(30, true)], [], dia(31));
  assert.equal(r.estado, 'recorrente');
  assert.equal(r.etapa, 6);
  assert.equal(r.transicoes.at(-1).causa, 'pedido');
});

test('3ª compra ASSISTIDA não conta; a 4ª autônoma no prazo conta', () => {
  const a = avaliar(ponto(), [ped(0, false), ped(10), ped(30, false)], [], dia(31));
  assert.equal(a.estado, 'ativacao');
  const b = avaliar(ponto(), [ped(0, false), ped(10), ped(30, false), ped(40, true)], [], dia(41));
  assert.equal(b.estado, 'recorrente');
});

test('45 dias: no limite ainda está em ativação; passou → ativação vencida (causa tempo)', () => {
  const ps = [ped(0, false), ped(10)];
  assert.equal(avaliar(ponto(), ps, [], dia(45)).estado, 'ativacao');
  const r = avaliar(ponto(), ps, [], dia(45, 1));
  assert.equal(r.estado, 'ativacao_vencida');
  const tr = r.transicoes.at(-1);
  assert.equal(tr.causa, 'tempo');
  assert.equal(tr.ts, dia(45).toISOString());
});

test('3ª compra autônoma DEPOIS dos 45 dias não vira recorrente', () => {
  const r = avaliar(ponto(), [ped(0, false), ped(10), ped(46, true)], [], dia(47));
  assert.equal(r.estado, 'ativacao_vencida');
});

test('120 dias: com 120 ainda não; mais de 120 sem comprar → churn', () => {
  const ps = [ped(0, false), ped(10), ped(20)];
  assert.equal(avaliar(ponto(), ps, [], dia(140)).estado, 'recorrente');
  const r = avaliar(ponto(), ps, [], dia(140, 1));
  assert.equal(r.estado, 'churn');
  assert.equal(r.transicoes.at(-1).ts, dia(140).toISOString());
  assert.equal(r.prazo.texto, '120 dias sem comprar');
});

test('ativação vencida também vira churn depois de 120 dias', () => {
  const r = avaliar(ponto(), [ped(0, false)], [], dia(130));
  assert.deepEqual(r.transicoes.map((t) => t.para), ['cadastrado_sem_compra', 'ativacao', 'ativacao_vencida', 'churn']);
});

test('retorno de churn: compra reinicia o ciclo e o relógio dos 45 dias', () => {
  const ps = [ped(0, false), ped(10), ped(20), ped(200, false)];
  const r = avaliar(ponto(), ps, [], dia(210));
  assert.equal(r.estado, 'ativacao');
  assert.equal(r.ciclo_inicio, dia(200).toISOString());
  assert.equal(r.compras_ciclo, 1);
  assert.equal(r.prazo.dias_restantes, 35);
  // e pode virar recorrente de novo dentro do novo prazo
  const r2 = avaliar(ponto(), [...ps, ped(210), ped(230, true)], [], dia(231));
  assert.equal(r2.estado, 'recorrente');
});

test('pedido sem cadastro registrado implica cadastro na mesma hora', () => {
  const r = avaliar({}, [ped(0, false)], [], dia(1));
  assert.equal(r.estado, 'ativacao');
  assert.equal(r.transicoes[0].para, 'cadastrado_sem_compra');
});

test('pedido no futuro do relógio é ignorado', () => {
  assert.equal(avaliar(ponto(), [ped(5)], [], dia(1)).estado, 'cadastrado_sem_compra');
});

test('ponto migrado da V1 sem histórico mantém o estado declarado', () => {
  assert.equal(avaliar({ estado_base: 'recorrente' }, [], [], dia(0)).estado, 'recorrente');
});

test('etapas 1–3 vêm da visita; "Ponto fechado" não é visita efetiva', () => {
  const vis = (resultado, n = 0) => ({ checkin: { em: dia(n).toISOString() }, nucleo: { resultado } });
  const base = { estado: 'lead', nCiclo: 0, ponto: {}, visitas: [] };
  assert.equal(calcularEtapa(base), 0);
  assert.equal(calcularEtapa({ ...base, ponto: { planejado_em: dia(0).toISOString() } }), 1);
  assert.equal(calcularEtapa({ ...base, visitas: [vis('fechado')] }), 0);
  assert.equal(calcularEtapa({ ...base, visitas: [vis('aberto_sem_decisor')] }), 2);
  assert.equal(calcularEtapa({ ...base, visitas: [vis('aberto_sem_decisor'), vis('falou_com_decisor')] }), 3);
  // no churn, só contam as visitas depois da saída
  assert.equal(calcularEtapa({ ...base, estado: 'churn', visitas: [vis('falou_com_decisor', 0)], inicioCicloFunil: dia(5).getTime() }), 0);
});

test('tipo de visita sai do estado', () => {
  assert.equal(tipoVisitaPara('lead'), 'aquisicao');
  assert.equal(tipoVisitaPara('ativacao'), 'acompanhamento');
  assert.equal(tipoVisitaPara('churn'), 'reconquista');
});
