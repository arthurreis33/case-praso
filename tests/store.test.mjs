import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarStore, memoriaStorage, CHAVE_V1, CHAVE_DIARIO } from '../public/js/store.js';
import { adaptadorMemoria } from '../public/js/db.js';
import { DIA_MS } from '../public/js/estados.js';

function relogio(inicio) {
  let t = inicio.getTime();
  return { agora: () => new Date(t), passar: (s) => { t += s * 1000; } };
}
const novo = (opts = {}) => criarStore({ adaptador: adaptadorMemoria(), storage: memoriaStorage(), ...opts }).carregar();

test('persiste a cada operação e recarrega igual', async () => {
  const ad = adaptadorMemoria();
  const st = memoriaStorage();
  const s1 = await criarStore({ adaptador: ad, storage: st }).carregar();
  const p = s1.novoPonto({ nome_fantasia: 'X', tipo: 'bar', cnpj: '12.345.678/0001-00' });
  const v = s1.checkin(p.id);
  s1.setCampo(v.id, 'nucleo.resultado', 'recusou');
  await s1.gravado();
  assert.equal(st.getItem(CHAVE_DIARIO), null, 'diário limpo depois da confirmação');
  const s2 = await criarStore({ adaptador: ad, storage: st }).carregar();
  assert.equal(s2.ponto(p.id).cnpj, '12345678000100');
  assert.equal(s2.visita(v.id).nucleo.resultado, 'recusou');
});

test('aba fechada antes do IndexedDB confirmar: o diário síncrono recupera o toque', async () => {
  const ad = adaptadorMemoria();
  const st = memoriaStorage();
  const s1 = await criarStore({ adaptador: ad, storage: st }).carregar();
  const p = s1.novoPonto({ nome_fantasia: 'Y' });
  await s1.gravado();
  // a partir daqui o IndexedDB "trava" (aba fechou no meio da transação)
  ad.gravar = () => new Promise(() => {});
  const v = s1.checkin(p.id);
  s1.setCampo(v.id, 'nucleo.resultado', 'falou_com_decisor');
  assert.ok(st.getItem(CHAVE_DIARIO), 'o toque está no diário');
  const s2 = await criarStore({ adaptador: adaptadorMemoriaCom(ad), storage: st }).carregar();
  assert.equal(s2.visita(v.id)?.nucleo.resultado, 'falou_com_decisor');
});

// cópia do conteúdo do adaptador "travado", com gravar funcionando de novo
function adaptadorMemoriaCom(velho) {
  const a = adaptadorMemoria();
  for (const k of Object.keys(velho._d)) a._d[k] = velho._d[k] instanceof Map ? new Map(velho._d[k]) : velho._d[k];
  return a;
}

test('sem IndexedDB → segue em memória e avisa', async () => {
  const quebrado = { ...adaptadorMemoria(), abrir: async () => { throw new Error('SecurityError'); } };
  const s = await criarStore({ adaptador: quebrado, storage: memoriaStorage() }).carregar();
  assert.equal(s.emMemoria, true);
  assert.ok(s.erro);
  const p = s.novoPonto({ nome_fantasia: 'Z' });
  assert.ok(s.ponto(p.id));
});

test('primeira abertura migra o localStorage da V1 (mesmo domínio) e não apaga a chave da V1', async () => {
  const st = memoriaStorage();
  const v1 = { schema_version: 1, criado_em: '2026-10-01T10:00:00.000Z', ultimo_export: null, pontos: [
    { id: 'a', nome: 'Padaria A', tipo: 'padaria', endereco: 'Rua 1', cnpj: null, lat: -8.1, lng: -34.9, precisao_m: 8, coord_fonte: 'checkin', estado: 'lead', status_dia: 'retornar', retorno_sugerido: '2026-10-06T09:00:00.000Z', retorno_motivo: 'janela_decisor', decisor: { quem: 'dono', faixas: ['6-9'], dias: [], atualizado_em: 'x' }, criado_em: 'x', origem: 'rua', ficticio: false },
  ], visitas: [] };
  st.setItem(CHAVE_V1, JSON.stringify(v1));
  const s = await criarStore({ adaptador: adaptadorMemoria(), storage: st }).carregar();
  assert.equal(s.migrouV1, 1);
  assert.equal(s.ponto('a').nome_fantasia, 'Padaria A');
  assert.equal(s.ponto('a').status_dia, 'retornar');
  assert.ok(st.getItem(CHAVE_V1), 'chave da V1 continua lá como backup');
});

test('fluxo de visita: janela do decisor → retornar; decisor vai para o ponto', async () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = await novo({ agora: r.agora });
  const p = s.novoPonto({ nome_fantasia: 'Padaria' });
  const v = s.checkin(p.id);
  assert.equal(v.tipo, 'aquisicao');
  s.registrarGeo(v.id, { lat: -8.05, lng: -34.9, precisao_m: 9.4 });
  assert.equal(s.ponto(p.id).coord_confirmada.origem, 'checkin');
  r.passar(30);
  s.setCampo(v.id, 'nucleo.resultado', 'aberto_sem_decisor');
  s.setCampo(v.id, 'nucleo.quem_decide', 'dono');
  s.setCampo(v.id, 'nucleo.faixas', ['6-9']);
  r.passar(6);
  s.salvarNucleo(v.id);
  assert.equal(s.ponto(p.id).status_dia, 'retornar');
  assert.equal(new Date(s.ponto(p.id).retorno_sugerido).getTime(), new Date(2026, 9, 6, 6, 0).getTime());
  assert.equal(s.ponto(p.id).decisor.papel, 'dono');
  assert.deepEqual(s.ponto(p.id).decisor.janela.faixas, ['6-9']);
  assert.equal(s.ponto(p.id).etapa_funil, 2);
  r.passar(60);
  s.checkout(v.id);
  assert.equal(v.tempos.nucleo_s, 6); // do primeiro toque no núcleo até salvar
  assert.throws(() => s.checkin(p.id) && s.checkin(p.id), /aberta/);
});

test('GPS a mais de 150 m do pino não sobrescreve sozinho: devolve a distância para a pergunta', async () => {
  const s = await novo();
  const p = s.novoPonto({ nome_fantasia: 'Longe', coord_cadastral: { lat: -8.1, lng: -34.9 } });
  const v = s.checkin(p.id);
  const d = s.registrarGeo(v.id, { lat: -8.103, lng: -34.9, precisao_m: 10 });
  assert.ok(d > 150);
  assert.equal(s.ponto(p.id).coord_confirmada, null);
  s.corrigirPino(p.id, { lat: -8.103, lng: -34.9, precisao_m: 10 }, 'checkin');
  assert.equal(s.ponto(p.id).coord_confirmada.lat, -8.103);
});

test('nenhum card é movido à mão: simulador de cadastro e pedidos move o ponto e grava EventoEstado', async () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = await novo({ agora: r.agora });
  const p = s.novoPonto({ nome_fantasia: 'Lanchonete', tipo: 'lanchonete' });
  s.eventoCadastro(p.id);
  assert.equal(s.ponto(p.id).estado, 'cadastrado_sem_compra');
  assert.equal(s.avancos.get(p.id).texto, 'avançou: cadastro detectado');
  s.eventoPedido(p.id, { autonomo: false, itens: [{ sku: 'OG01', nome: 'Óleo', categoria: 'oleos_gorduras', qtd: 1, valor: 100 }] });
  assert.equal(s.ponto(p.id).estado, 'ativacao');
  s.avancarRelogio(10); s.eventoPedido(p.id, { autonomo: true });
  s.avancarRelogio(10); s.eventoPedido(p.id, { autonomo: true });
  assert.equal(s.ponto(p.id).estado, 'recorrente');
  assert.equal(s.ponto(p.id).etapa_funil, 6);
  const evs = s.eventosDo(p.id).filter((e) => e.dimensao === 'estado').map((e) => `${e.de}>${e.para}:${e.causa}`).reverse();
  assert.deepEqual(evs, ['lead>cadastrado_sem_compra:cadastro', 'cadastrado_sem_compra>ativacao:pedido', 'ativacao>recorrente:pedido']);
  // relógio: 121 dias depois vira churn por tempo, sozinho
  s.avancarRelogio(121);
  assert.equal(s.ponto(p.id).estado, 'churn');
  assert.equal(s.eventosDo(p.id)[0].causa, 'tempo');
  // reavaliar de novo não duplica eventos (idempotente)
  const n = s.estado.eventos.length;
  s.reavaliarTodos();
  assert.equal(s.estado.eventos.length, n);
});

test('correção manual: exige a função própria, grava correcao_manual e não vira selo de avanço', async () => {
  const s = await novo();
  const p = s.novoPonto({ nome_fantasia: 'P' });
  const v = s.checkin(p.id);
  s.setCampo(v.id, 'nucleo.resultado', 'falou_com_decisor');
  s.salvarNucleo(v.id); s.checkout(v.id);
  assert.equal(s.ponto(p.id).etapa_funil, 3);
  s.avancos.clear();
  s.corrigirResultadoVisita(v.id, 'aberto_sem_decisor');
  assert.equal(s.ponto(p.id).etapa_funil, 2);
  assert.equal(s.eventosDo(p.id)[0].causa, 'correcao_manual');
  assert.equal(s.avancos.has(p.id), false);
});

test('melhor horário no fechamento, editado depois do check-out → retornar', async () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = await novo({ agora: r.agora });
  const p = s.novoPonto({ nome_fantasia: 'Q' });
  const v = s.checkin(p.id);
  s.setCampo(v.id, 'nucleo.resultado', 'falou_com_decisor');
  s.salvarNucleo(v.id); s.checkout(v.id);
  assert.equal(s.ponto(p.id).status_dia, 'visitado');
  s.setCampo(v.id, 'pesquisa.fechamento.melhor_horario.faixas', ['14-17']);
  assert.equal(s.ponto(p.id).status_dia, 'retornar');
  assert.equal(s.ponto(p.id).retorno_motivo, 'melhor_horario');
});

test('relógio da pesquisa: primeiro e último toque, sem mexer no núcleo', async () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = await novo({ agora: r.agora });
  const v = s.checkin(s.novoPonto({ nome_fantasia: 'R' }).id);
  s.setCampo(v.id, 'pesquisa.papeis.quem_paga', 'decisor');
  r.passar(200);
  s.setCampo(v.id, 'pesquisa.pagamento.prazo', '28-30');
  assert.equal((new Date(v.pesquisa.fim) - new Date(v.pesquisa.inicio)) / 1000, 200);
  assert.equal(v.nucleo.inicio, null);
});

test('importar backup V1 substitui o estado e migra', async () => {
  const s = await novo();
  s.novoPonto({ nome_fantasia: 'antigo' });
  const n = s.importar(JSON.stringify({ schema_version: 1, pontos: [{ id: 'z', nome: 'novo', estado: 'cliente' }], visitas: [] }));
  assert.equal(n, 1);
  assert.equal(s.estado.pontos[0].nome_fantasia, 'novo');
  assert.equal(s.estado.pontos[0].estado, 'recorrente');
});

test('remover fictícios não toca dados reais', async () => {
  const s = await novo();
  s.novoPonto({ nome_fantasia: 'real' }); s.novoPonto({ nome_fantasia: 'fake', ficticio: true });
  s.removerFicticios();
  assert.deepEqual(s.estado.pontos.map((p) => p.nome_fantasia), ['real']);
});

test('relógio simulado: agora() anda N dias', async () => {
  const r = relogio(new Date(2026, 9, 5, 10, 0));
  const s = await novo({ agora: r.agora });
  s.avancarRelogio(3);
  assert.equal(s.agora().getTime() - r.agora().getTime(), 3 * DIA_MS);
  assert.equal(s.offsetDias, 3);
  s.zerarRelogio();
  assert.equal(s.offsetDias, 0);
});
