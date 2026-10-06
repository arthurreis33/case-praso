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
