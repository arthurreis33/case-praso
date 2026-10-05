import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore, memoriaStorage } from '../public/js/store.js';
import { paraCSV, paraJSON } from '../public/js/export.js';

function montar() {
  const s = criarStore({ storage: memoriaStorage() }).carregar();
  const p = s.novoPonto({ nome: 'Bar; do "Zé"', tipo: 'bar', endereco: 'Rua A, 1' });
  const q = s.novoPonto({ nome: 'Sem visita' });
  for (let i = 0; i < 2; i++) {
    const v = s.checkin(p.id);
    s.setCampo(v.id, 'nucleo.resultado', 'recusou');
    s.setCampo(v.id, 'pesquisa.pagamento.forma', 'boleto_prazo');
    s.setCampo(v.id, 'pesquisa.apps.estimulado.conhece', ['bees', 'praso']);
    s.setCampo(v.id, 'surpresa', 'linha 1\nlinha 2');
    s.salvarNucleo(v.id); s.checkout(v.id);
  }
  return { s, p, q };
}

// parser mínimo de CSV com aspas, para checar o arquivo de verdade
function parse(txt) {
  const rows = []; let row = [], cel = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cel += '"'; i++; } else if (c === '"') q = false; else cel += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cel); cel = ''; }
    else if (c === '\r') {}
    else if (c === '\n') { row.push(cel); rows.push(row); row = []; cel = ''; }
    else cel += c;
  }
  return rows;
}

test('CSV: uma linha por visita, dados do ponto juntos, aspas e quebras preservadas', () => {
  const { s, p } = montar();
  const csv = paraCSV(s.estado);
  assert.ok(csv.startsWith('﻿'));
  const rows = parse(csv.slice(1));
  const cab = rows[0];
  assert.equal(rows.length, 1 + 2); // 2 visitas; ponto sem visita não gera linha
  assert.ok(rows.every((r) => r.length === cab.length));
  const l = Object.fromEntries(cab.map((c, i) => [c, rows[1][i]]));
  assert.equal(l.ponto_nome, p.nome);
  assert.equal(l.surpresa, 'linha 1\nlinha 2');
  assert.equal(l.p6_estimulado_conhece, 'bees|praso');
  assert.equal(l.schema_version, '1');
  assert.equal(l.nucleo_salvo_no_ponto, 'sim');
});

test('JSON: completo, com schema_version e ponto sem visita', () => {
  const { s, q } = montar();
  const j = JSON.parse(paraJSON(s.estado));
  assert.equal(j.schema_version, 1);
  assert.ok(j.exportado_em);
  assert.ok(j.pontos.find((x) => x.id === q.id));
  assert.equal(j.visitas.length, 2);
});
