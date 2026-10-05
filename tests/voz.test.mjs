import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairCampos, NOTAS_EXEMPLO } from '../public/js/extrair.js';
import { validar } from '../api/transcrever.js';
import { criarStore } from '../public/js/store.js';

const agora = new Date(2026, 9, 5, 10, 0); // segunda

test('extração por regras (modo demonstração) a partir da nota de exemplo', () => {
  const c = extrairCampos(NOTAS_EXEMPLO.falou_com_decisor, { agora });
  assert.equal(c['nucleo.resultado'], 'falou_com_decisor');
  assert.equal(c['nucleo.quem_decide'], 'dono');
  assert.deepEqual(c['nucleo.faixas'], ['14-17']);
  assert.equal(c['pesquisa.ultima_compra.canal'], 'whatsapp');
  assert.equal(c['pesquisa.fornecedores.quantos'], '2');
  assert.equal(c['pesquisa.pagamento.prazo'], '28-30');
  assert.equal(c.proxima_acao.tipo, 'retorno');
  assert.equal(new Date(c.proxima_acao.data_hora).getDay(), 4, 'quinta');
  assert.equal(new Date(c.proxima_acao.data_hora).getHours(), 14);
});

test('decisor ausente: sem motivo de não avanço, retorno amanhã à tarde', () => {
  const c = extrairCampos(NOTAS_EXEMPLO.aberto_sem_decisor, { agora });
  assert.equal(c['nucleo.resultado'], 'aberto_sem_decisor');
  assert.equal(c.motivo_nao_avanco, undefined);
  assert.equal(new Date(c.proxima_acao.data_hora).getDate(), 6);
  assert.equal(c['pesquisa.pagamento.forma'], 'dinheiro_pix');
});

test('recusa: motivo extraído', () => {
  const c = extrairCampos(NOTAS_EXEMPLO.recusou, { agora });
  assert.equal(c['nucleo.resultado'], 'recusou');
  assert.equal(c.motivo_nao_avanco, 'tem_fornecedor');
});

test('o servidor só aceita chaves e valores do catálogo (o LLM não inventa)', () => {
  const r = validar({ 'nucleo.resultado': 'fechou_negocio', 'nucleo.faixas': ['14-17', 'madrugada'], telefone: '81999999999', proxima_acao: { tipo: 'retorno', data_hora: '2026-10-08T14:00:00-03:00' } });
  assert.equal(r['nucleo.resultado'], undefined);
  assert.deepEqual(r['nucleo.faixas'], ['14-17']);
  assert.equal(r.telefone, undefined);
  assert.equal(r.proxima_acao.data_hora, '2026-10-08T17:00:00.000Z');
});

test('fila: áudio → pendente → transcrito; a IA sugere e só preenche com o toque, marcando os campos', async () => {
  const s = await criarStore({ agora: () => agora }).carregar();
  const p = s.novoPonto({ nome_fantasia: 'Bar' });
  const v = s.checkin(p.id);
  await s.salvarAudio(v.id, new Blob(['x'], { type: 'audio/webm' }));
  s.registrarAudio(v.id, { mime: 'audio/webm', dur_s: 12 });
  assert.equal(v.transcricao_status, 'pendente');
  assert.equal(v.nota_origem, 'voz');
  const campos = extrairCampos(NOTAS_EXEMPLO.falou_com_decisor, { agora });
  s.registrarTranscricao(v.id, { status: 'ok', texto: NOTAS_EXEMPLO.falou_com_decisor, campos, modo: 'demo' });
  assert.equal(v.nucleo.resultado, null, 'nada é preenchido sem o toque');
  assert.ok(v.nota_texto.startsWith('Falei com o dono'));
  s.aplicarIA(v.id);
  assert.equal(v.nucleo.resultado, 'falou_com_decisor');
  assert.ok(v.campos_ia.includes('nucleo.resultado'));
  assert.ok(v.nucleo.fim, 'núcleo salvo');
  assert.equal(s.ponto(p.id).status_dia, 'retornar');
  // tocar no campo depois tira a marca de IA
  s.setCampo(v.id, 'nucleo.resultado', 'recusou');
  assert.equal(v.campos_ia.includes('nucleo.resultado'), false);
});
