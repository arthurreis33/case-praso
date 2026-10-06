// V2.1 · modo demonstração: escondido por padrão, alterna com 5 toques seguidos (em até 3 s).
import test from 'node:test';
import assert from 'node:assert/strict';
import { modoDemo, ligarDemo, toqueNaMarca } from '../public/js/demo.js';

test('modo demonstração começa desligado fora do navegador', () => {
  assert.equal(modoDemo(), false);
});

test('cinco toques em até 3 s ligam; quatro não', () => {
  ligarDemo(false);
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) assert.equal(toqueNaMarca(t0 + i * 300), false);
  assert.equal(modoDemo(), false);
  assert.equal(toqueNaMarca(t0 + 1500), true);
  assert.equal(modoDemo(), true);
});

test('toques espaçados demais não contam', () => {
  ligarDemo(false);
  const t0 = 2_000_000;
  for (let i = 0; i < 5; i++) assert.equal(toqueNaMarca(t0 + i * 1000), false);
  assert.equal(modoDemo(), false);
});
