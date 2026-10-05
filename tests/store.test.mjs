import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore, memoriaStorage, CHAVE } from '../public/js/store.js';

function relogio(inicio) {
  let t = inicio.getTime();
  return { agora: () => new Date(t), passar: (s) => { t += s * 1000; } };
}

test('persiste a cada operação e recarrega igual (fechar a aba não perde dado)', () => {
  const st = memoriaStorage();
  const s1 = criarStore({ storage: st }).carregar();
  const p = s1.novoPonto({ nome: 'X', tipo: 'bar', cnpj: '12.345.678/0001-00' });
  const v = s1.checkin(p.id);
  s1.setCampo(v.id, 'nucleo.resultado', 'recusou');
  const s2 = criarStore({ storage: st }).carregar();
  assert.equal(s2.ponto(p.id).cnpj, '12345678000100');
  assert.equal(s2.visita(v.id).nucleo.resultado, 'recusou');
});

test('armazenamento vazio → app começa vazio', () => {
  const s = criarStore({ storage: memoriaStorage() }).carregar();
  assert.equal(s.estado.pontos.length, 0);
  assert.equal(s.estado.schema_version, 1);
});

test('storage que lança exceção → segue em memória e avisa', () => {
  const quebrado = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('x'); } };
  const s = criarStore({ storage: quebrado }).carregar();
  assert.equal(s.emMemoria, true);
  assert.ok(s.erro);
  const p = s.novoPonto({ nome: 'Y' });
  assert.ok(s.ponto(p.id));
});

test('storage cheio no salvar → erro visível, dado continua na memória', () => {
  const st = memoriaStorage();
  const s = criarStore({ storage: st }).carregar();
  st.setItem = () => { throw new Error('QuotaExceededError'); };
  const p = s.novoPonto({ nome: 'Z' });
  assert.ok(s.erro);
  assert.ok(s.ponto(p.id));
});

test('JSON corrompido → guarda cópia e começa vazio', () => {
  const st = memoriaStorage();
  st.setItem(CHAVE, '{quebrado');
  const s = criarStore({ storage: st }).carregar();
  assert.equal(s.estado.pontos.length, 0);
  assert.ok(s.erro);
});

test('fluxo completo: núcleo com janela → retornar; revisita guarda o previsto', () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0)); // seg 10h
  const s = criarStore({ storage: memoriaStorage(), agora: r.agora }).carregar();
  const p = s.novoPonto({ nome: 'Padaria' });
  const v = s.checkin(p.id);
  s.registrarGeo(v.id, { lat: -8.05, lng: -34.9, precisao_m: 9.4 });
  assert.equal(s.ponto(p.id).coord_fonte, 'checkin');
  r.passar(30);
  s.setCampo(v.id, 'nucleo.resultado', 'aberto_sem_decisor');
  r.passar(4);
  s.setCampo(v.id, 'nucleo.quem_decide', 'dono');
  s.setCampo(v.id, 'nucleo.faixas', ['6-9']);
  r.passar(6);
  s.salvarNucleo(v.id);
  assert.equal(s.ponto(p.id).status_dia, 'retornar');
  assert.equal(s.ponto(p.id).retorno_motivo, 'janela_decisor');
  assert.equal(new Date(s.ponto(p.id).retorno_sugerido).getTime(), new Date(2026, 9, 6, 6, 0).getTime());
  assert.equal(s.ponto(p.id).decisor.quem, 'dono');
  r.passar(60);
  s.checkout(v.id);
  assert.equal(s.ponto(p.id).status_dia, 'retornar');
  assert.throws(() => s.checkin(p.id) && s.checkin(p.id), /aberta/);
});

test('uma visita aberta por vez', () => {
  const s = criarStore({ storage: memoriaStorage() }).carregar();
  const a = s.novoPonto({ nome: 'A' }); const b = s.novoPonto({ nome: 'B' });
  s.checkin(a.id);
  assert.throws(() => s.checkin(b.id), /aberta/);
});

test('revisita: decisor presente → visitado e desvio medido', () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = criarStore({ storage: memoriaStorage(), agora: r.agora }).carregar();
  const p = s.novoPonto({ nome: 'P' });
  const v1 = s.checkin(p.id);
  s.setCampo(v1.id, 'nucleo.resultado', 'aberto_sem_decisor');
  s.setCampo(v1.id, 'nucleo.faixas', ['6-9']);
  s.salvarNucleo(v1.id); s.checkout(v1.id);
  r.passar(20 * 3600 + 10 * 60); // ter 06:10
  const v2 = s.checkin(p.id);
  assert.ok(v2.retorno_previsto);
  s.setCampo(v2.id, 'nucleo.resultado', 'falou_com_decisor');
  s.salvarNucleo(v2.id); s.checkout(v2.id);
  assert.equal(s.ponto(p.id).status_dia, 'visitado');
  assert.equal(s.ponto(p.id).retorno_sugerido, null);
});

test('melhor horário no fechamento, editado depois do check-out → retornar', () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = criarStore({ storage: memoriaStorage(), agora: r.agora }).carregar();
  const p = s.novoPonto({ nome: 'Q' });
  const v = s.checkin(p.id);
  s.setCampo(v.id, 'nucleo.resultado', 'falou_com_decisor');
  s.salvarNucleo(v.id); s.checkout(v.id);
  assert.equal(s.ponto(p.id).status_dia, 'visitado');
  s.setCampo(v.id, 'pesquisa.fechamento.melhor_horario.faixas', ['14-17']);
  assert.equal(s.ponto(p.id).status_dia, 'retornar');
  assert.equal(s.ponto(p.id).retorno_motivo, 'melhor_horario');
});

test('relógio da pesquisa: primeiro e último toque', () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = criarStore({ storage: memoriaStorage(), agora: r.agora }).carregar();
  const v = s.checkin(s.novoPonto({ nome: 'R' }).id);
  s.setCampo(v.id, 'pesquisa.papeis.quem_paga', 'decisor');
  r.passar(200);
  s.setCampo(v.id, 'pesquisa.pagamento.prazo', '28-30');
  assert.equal((new Date(v.pesquisa.fim) - new Date(v.pesquisa.inicio)) / 1000, 200);
  assert.equal(v.nucleo.inicio, null); // pesquisa não mexe no relógio do núcleo
});

test('importar backup substitui e guarda o anterior', () => {
  const st = memoriaStorage();
  const a = criarStore({ storage: st }).carregar();
  a.novoPonto({ nome: 'antigo' });
  const b = criarStore({ storage: memoriaStorage() }).carregar();
  b.novoPonto({ nome: 'novo' });
  a.importar(JSON.stringify(b.estado));
  assert.equal(a.estado.pontos[0].nome, 'novo');
});

test('remover fictícios não toca dados reais', () => {
  const s = criarStore({ storage: memoriaStorage() }).carregar();
  s.novoPonto({ nome: 'real' }); s.novoPonto({ nome: 'fake', ficticio: true });
  s.removerFicticios();
  assert.deepEqual(s.estado.pontos.map((p) => p.nome), ['real']);
});
