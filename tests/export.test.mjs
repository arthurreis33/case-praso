import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore, memoriaStorage } from '../public/js/store.js';
import { adaptadorMemoria } from '../public/js/db.js';
import { paraCSV, paraJSON } from '../public/js/export.js';

// as 55 colunas da V1, na ordem: a V2 só acrescenta colunas no fim
const COLUNAS_V1 = 'schema_version;visita_id;ponto_id;ponto_nome;ponto_tipo;ponto_endereco;ponto_cnpj;ponto_estado;ponto_status_dia;ponto_origem;ponto_ficticio;ponto_retorno_sugerido;ponto_retorno_motivo;checkin_em;checkin_lat;checkin_lng;checkin_precisao_m;checkin_gps_erro;checkout_em;versao_conversa;observacao;nucleo_resultado;nucleo_quem_decide;nucleo_faixas;nucleo_dias;p2_quem_paga;p2_quem_recebe;p3_canal;p3_de_quem;p3_anterior_parecida;p4_n_fornecedores;p4_dor_de_cabeca;p5_ultima_troca;p5_o_que_fez_mudar;p5_quase_desistiu;p6_espontaneo_ja_comprou;p6_espontaneo_qual;p6_estimulado_conhece;p6_estimulado_usou;p7_forma_pagamento;p7_prazo;p7_deixou_de_comprar;p7_deixou_de_comprar_texto;p8_pode_voltar;p8_melhor_faixas;p8_melhor_dias;p8_indicacao;surpresa;registro_modo;tempo_no_ponto_s;tempo_nucleo_s;tempo_pesquisa_s;nucleo_salvo_no_ponto;revisita_retorno_previsto;revisita_desvio_min'.split(';');

async function montar() {
  const s = await criarStore({ adaptador: adaptadorMemoria(), storage: memoriaStorage() }).carregar();
  const p = s.novoPonto({ nome_fantasia: 'Bar; do "Zé"', tipo: 'bar', endereco_cadastral: 'Rua A, 1' });
  const q = s.novoPonto({ nome_fantasia: 'Sem visita' });
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

test('CSV: uma linha por visita, dados do ponto juntos, aspas e quebras preservadas', async () => {
  const { s, p } = await montar();
  const csv = paraCSV(s.estado);
  assert.ok(csv.startsWith('﻿'));
  const rows = parse(csv.slice(1));
  const cab = rows[0];
  assert.equal(rows.length, 1 + 2); // 2 visitas; ponto sem visita não gera linha
  assert.ok(rows.every((r) => r.length === cab.length));
  const l = Object.fromEntries(cab.map((c, i) => [c, rows[1][i]]));
  assert.deepEqual(cab.slice(0, COLUNAS_V1.length), COLUNAS_V1, 'colunas da V1 primeiro, mesma ordem');
  assert.ok(cab.includes('v2_proxima_acao'));
  assert.equal(l.ponto_nome, p.nome_fantasia);
  assert.equal(l.surpresa, 'linha 1\nlinha 2');
  assert.equal(l.p6_estimulado_conhece, 'bees|praso');
  assert.equal(l.schema_version, '2');
  assert.equal(l.nucleo_resultado, 'recusou');
  assert.equal(l.nucleo_salvo_no_ponto, 'sim');
});

test('JSON: completo, com schema_version e ponto sem visita', async () => {
  const { s, q } = await montar();
  const j = JSON.parse(paraJSON(s.estado));
  assert.equal(j.schema_version, 2);
  assert.ok(Array.isArray(j.eventos) && Array.isArray(j.pedidos));
  assert.ok(j.exportado_em);
  assert.ok(j.pontos.find((x) => x.id === q.id));
  assert.equal(j.visitas.length, 2);
});
