// V2.1 · mensagens prontas com as condições como estão em praso.com.br.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDICOES, cesta, modeloPara } from '../public/js/whatsapp.js';

test('condições: sem mínimo, frete grátis só para CNPJ, dia seguinte de segunda a sábado', () => {
  assert.match(CONDICOES, /Sem pedido mínimo/);
  assert.match(CONDICOES, /frete grátis para CNPJ/);
  assert.match(CONDICOES, /19h chega no dia seguinte, de segunda a sábado/);
  assert.doesNotMatch(CONDICOES, /chega amanhã/);
});

test('modelo de mensagem por estado', () => {
  assert.equal(modeloPara('churn'), 'reconquista');
  assert.equal(modeloPara('ativacao'), 'recompra');
  assert.equal(modeloPara('lead'), 'lembrete_1a_compra');
});

test('cesta de entrada: de 3 a 5 itens do catálogo, com total', () => {
  for (const tipo of ['lanchonete', 'hamburgueria', 'pizzaria', 'padaria', 'restaurante', 'cafeteria', 'bar', 'outro']) {
    const c = cesta(tipo);
    assert.ok(c.itens.length >= 3 && c.itens.length <= 5, tipo);
    assert.ok(c.total > 0);
  }
});
