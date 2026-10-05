import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximaOcorrencia, calcularRetorno, duracoes, distanciaM } from '../public/js/rules.js';

// segunda-feira, 05/10/2026
const seg = (h, m = 0) => new Date(2026, 9, 5, h, m);

test('janela ainda por vir hoje → hoje', () => {
  assert.deepEqual(proximaOcorrencia(seg(7), ['14-17']), new Date(2026, 9, 5, 14, 0));
});
test('dentro da janela agora → próxima ocorrência, não agora', () => {
  assert.deepEqual(proximaOcorrencia(seg(10), ['9-1130']), new Date(2026, 9, 6, 9, 0));
});
test('várias faixas → a mais próxima', () => {
  assert.deepEqual(proximaOcorrencia(seg(12), ['6-9', '17-20']), new Date(2026, 9, 5, 17, 0));
});
test('11h30 começa às 11:30', () => {
  assert.deepEqual(proximaOcorrencia(seg(10), ['1130-14']), new Date(2026, 9, 5, 11, 30));
});
test('respeita os dias marcados (sáb = 6)', () => {
  assert.deepEqual(proximaOcorrencia(seg(10), ['6-9'], ['6']), new Date(2026, 9, 10, 6, 0));
});
test('mesmo dia da semana, janela já passou → semana que vem', () => {
  assert.deepEqual(proximaOcorrencia(seg(10), ['6-9'], ['1']), new Date(2026, 9, 12, 6, 0));
});
test('noite = 20h', () => {
  assert.deepEqual(proximaOcorrencia(seg(10), ['noite']), new Date(2026, 9, 5, 20, 0));
});
test('sem faixa → null', () => {
  assert.equal(proximaOcorrencia(seg(10), [], ['1']), null);
});

test('RF10: aberto sem decisor + janela → retornar', () => {
  const r = calcularRetorno({ nucleo: { resultado: 'aberto_sem_decisor', faixas: ['6-9'], dias: [] } }, seg(10));
  assert.equal(r.motivo, 'janela_decisor');
  assert.deepEqual(r.quando, new Date(2026, 9, 6, 6, 0));
});
test('RF10: aberto sem decisor SEM janela → não retorna', () => {
  assert.equal(calcularRetorno({ nucleo: { resultado: 'aberto_sem_decisor', faixas: [] } }, seg(10)), null);
});
test('RF10: falou com decisor sem melhor horário → não retorna', () => {
  assert.equal(calcularRetorno({ nucleo: { resultado: 'falou_com_decisor', faixas: ['6-9'] } }, seg(10)), null);
});
test('RF10: melhor horário do fechamento manda, mesmo com decisor', () => {
  const v = { nucleo: { resultado: 'falou_com_decisor', faixas: [] },
    pesquisa: { fechamento: { melhor_horario: { faixas: ['14-17'], dias: ['3'] } } } };
  const r = calcularRetorno(v, seg(10));
  assert.equal(r.motivo, 'melhor_horario');
  assert.deepEqual(r.quando, new Date(2026, 9, 7, 14, 0));
});

test('RF11: durações e núcleo no ponto', () => {
  const v = {
    checkin: { em: '2026-10-05T12:00:00.000Z' }, checkout: { em: '2026-10-05T12:10:00.000Z' },
    nucleo: { inicio: '2026-10-05T12:01:00.000Z', fim: '2026-10-05T12:01:15.000Z' },
    pesquisa: { inicio: '2026-10-05T12:02:00.000Z', fim: '2026-10-05T12:08:00.000Z' },
  };
  const d = duracoes(v);
  assert.equal(d.tempo_no_ponto_s, 600);
  assert.equal(d.tempo_nucleo_s, 15);
  assert.equal(d.tempo_pesquisa_s, 360);
  assert.equal(d.nucleo_no_ponto, true);
});
test('RF11: núcleo salvo depois do check-out → fora do ponto', () => {
  const d = duracoes({ checkin: { em: '2026-10-05T12:00:00Z' }, checkout: { em: '2026-10-05T12:05:00Z' },
    nucleo: { inicio: '2026-10-05T12:06:00Z', fim: '2026-10-05T12:06:10Z' }, pesquisa: {} });
  assert.equal(d.nucleo_no_ponto, false);
});

test('haversine ~ 111 m por 0,001° de latitude', () => {
  assert.ok(Math.abs(distanciaM(-8, -34.9, -8.001, -34.9) - 111) <= 1);
});
