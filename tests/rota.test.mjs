import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planejar } from '../public/js/rota.js';
import { criarStore } from '../public/js/store.js';
import { avaliarPrioridade } from '../public/js/prioridade.js';
import { proximaOcorrencia } from '../public/js/rules.js';

const D = (h, m = 0) => new Date(2026, 9, 6, h, m); // terça
const base = { lat: -8.1, lng: -34.9 };
const perto = (i) => ({ lat: -8.1 + i * 0.003, lng: -34.9 }); // ~330 m entre pontos
const dia = [[D(6), D(22)]];
const entrada = (paradas, extra = {}) => ({
  inicio: D(8), fimJornada: D(18), almoco: [D(12), D(13)], base, velocidade_kmh: 20, tortuosidade: 1.4,
  maxParadas: 12, esperaMaxMin: 40, paradas, ...extra,
});

test('pontos em linha são visitados em ordem e o horário anda', () => {
  const ps = [3, 1, 2].map((i) => ({ id: `p${i}`, ...perto(i), duracao_min: 15, valor: 1, janelas: dia }));
  const r = planejar(entrada(ps));
  assert.deepEqual(r.ordem.map((o) => o.id), ['p1', 'p2', 'p3']);
  assert.ok(r.ordem[1].chegada > r.ordem[0].saida - 1);
  assert.equal(r.nao_couberam.length, 0);
});

test('janela do decisor: não chega antes da janela abrir (espera curta é aceita)', () => {
  const r = planejar(entrada([{ id: 'a', ...perto(1), duracao_min: 15, valor: 1, janelas: [[D(8, 30), D(9, 30)]] }]));
  assert.equal(r.ordem[0].inicio.getTime(), D(8, 30).getTime());
  assert.ok(r.ordem[0].espera_min > 0);
});

test('espera longa demais → não coube, com o motivo', () => {
  const r = planejar(entrada([{ id: 'a', ...perto(1), duracao_min: 15, valor: 1, janelas: [[D(16), D(17)]] }], { inicio: D(8) }));
  assert.equal(r.ordem.length, 0);
  assert.match(r.nao_couberam[0].motivo, /esperar/);
});

test('retorno com hora marcada (restrição dura) entra no horário, e o resto encaixa em volta', () => {
  const ps = [
    { id: 'dura', ...perto(5), duracao_min: 15, valor: 0.1, dura: true, janelas: [[D(10), D(10, 30)]] },
    ...[1, 2, 3].map((i) => ({ id: `p${i}`, ...perto(i), duracao_min: 20, valor: 1, janelas: dia })),
  ];
  const r = planejar(entrada(ps));
  const d = r.ordem.find((o) => o.id === 'dura');
  assert.ok(d, 'a parada dura entrou');
  assert.ok(d.inicio >= D(10) && d.inicio <= D(10, 30));
  assert.equal(r.ordem.length, 4);
});

test('almoço: nenhuma visita atravessa o almoço', () => {
  const ps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({ id: `p${i}`, ...perto(i % 4), duracao_min: 30, valor: 1, janelas: dia }));
  const r = planejar(entrada(ps, { inicio: D(10) }));
  for (const o of r.ordem) assert.ok(o.saida <= D(12) || o.inicio >= D(13), `${o.id} atravessa o almoço`);
});

test('fim da jornada: o que não dá para voltar à base fica de fora', () => {
  const ps = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `p${i}`, ...perto(i), duracao_min: 60, valor: 1, janelas: dia }));
  const r = planejar(entrada(ps, { inicio: D(14) }));
  assert.ok(r.ordem.length < 6);
  assert.ok(r.fim <= D(18));
  assert.ok(r.nao_couberam.length > 0);
});

test('prioridade: retorno hoje sobe e explica; recusa recente derruba; fechado hoje bloqueia', async () => {
  const agora = D(8);
  const s = await criarStore({ agora: () => agora }).carregar();
  const a = s.novoPonto({ nome_fantasia: 'A', tipo: 'restaurante', mei: false, coord_cadastral: perto(1) });
  s.atualizarPonto(a.id, { status_dia: 'retornar', retorno_sugerido: D(15).toISOString(), retorno_motivo: 'janela_decisor' });
  const ra = avaliarPrioridade(s, s.ponto(a.id));
  assert.equal(ra.valor, 3);
  assert.ok(ra.retornoHoje);
  assert.match(ra.motivos.join(' · '), /Vale 3 pt · retorno combinado às 15:00/);

  const b = s.novoPonto({ nome_fantasia: 'B', tipo: 'bar' });
  const v = s.checkin(b.id); s.setCampo(v.id, 'nucleo.resultado', 'recusou'); s.salvarNucleo(v.id); s.checkout(v.id);
  const rb = avaliarPrioridade(s, s.ponto(b.id));
  assert.match(rb.motivos.join(), /recusou há/);
  assert.ok(rb.chance < 0.15);

  const c = s.novoPonto({ nome_fantasia: 'C', tipo: 'padaria', horario_funcionamento: { dias: ['1', '3'], faixas: null } });
  assert.equal(avaliarPrioridade(s, s.ponto(c.id)).bloqueio, 'fechado hoje');
  assert.equal(avaliarPrioridade(s, s.ponto(c.id)).esperados, 0);
});

test('janela do decisor cruzando a chegada sobe a chance; pico derruba', async () => {
  const s = await criarStore({ agora: () => D(8) }).carregar();
  const p = s.novoPonto({ nome_fantasia: 'R', tipo: 'restaurante', decisor: { papel: 'dono', janela: { dias: [], faixas: ['14-17'] } } });
  const naJanela = avaliarPrioridade(s, s.ponto(p.id), { chegada: D(15) });
  const fora = avaliarPrioridade(s, s.ponto(p.id), { chegada: D(10, 30) });
  const pico = avaliarPrioridade(s, s.ponto(p.id), { chegada: D(12) });
  assert.ok(naJanela.chance > fora.chance);
  assert.match(naJanela.motivos.join(), /decisor costuma estar das 14h às 17h/);
  assert.match(pico.motivos.join(), /pico/);
  assert.ok(pico.chance < fora.chance);
  assert.ok(proximaOcorrencia);
});
