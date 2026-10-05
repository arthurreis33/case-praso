import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrar } from '../public/js/migrar.js';

// Fixture no formato exato da V1 (schema_version 1), com um ponto de cada caso.
const V1 = {
  schema_version: 1, criado_em: '2026-10-03T12:00:00.000Z', ultimo_export: '2026-10-04T22:00:00.000Z',
  pontos: [
    { id: 'p1', nome: 'Lanchonete A', tipo: 'lanchonete', endereco: 'Rua X, 10', cnpj: '99999999000199', lat: -8.06, lng: -34.87, precisao_m: 12, coord_fonte: 'checkin', estado: 'lead', status_dia: 'retornar', retorno_sugerido: '2026-10-06T09:00:00.000Z', retorno_motivo: 'janela_decisor', decisor: { quem: 'dono', faixas: ['6-9', '17-20'], dias: ['1'], atualizado_em: '2026-10-05T13:00:00.000Z' }, criado_em: '2026-10-03T12:00:00.000Z', origem: 'lista', ficticio: false },
    { id: 'p2', nome: 'Bar B', tipo: 'bar', endereco: '', cnpj: null, lat: -8.07, lng: -34.88, precisao_m: 30, coord_fonte: 'exemplo', estado: 'cliente', status_dia: 'a_visitar', retorno_sugerido: null, retorno_motivo: null, decisor: null, criado_em: '2026-10-03T12:00:00.000Z', origem: 'rua', ficticio: true },
    { id: 'p3', nome: 'Pizzaria C', tipo: 'pizzaria', endereco: '', cnpj: null, lat: null, lng: null, precisao_m: null, coord_fonte: null, estado: 'oportunidade', status_dia: 'visitado', decisor: null, criado_em: 'x', origem: 'lista', ficticio: false },
  ],
  visitas: [
    { id: 'v1', ponto_id: 'p1', checkin: { em: '2026-10-05T13:00:00.000Z', lat: -8.06, lng: -34.87, precisao_m: 12, gps_erro: null, gps_em: '2026-10-05T13:00:05.000Z' }, checkout: { em: '2026-10-05T13:15:00.000Z' }, retorno_previsto: null, versao_conversa: '2min', observacao: ['sacola_atacarejo'], nucleo: { resultado: 'aberto_sem_decisor', quem_decide: 'dono', faixas: ['6-9'], dias: [], inicio: '2026-10-05T13:01:00.000Z', fim: '2026-10-05T13:01:40.000Z', editado_em: null }, pesquisa: { inicio: '2026-10-05T13:02:00.000Z', fim: '2026-10-05T13:10:00.000Z', papeis: { quem_paga: 'outra_pessoa' } }, surpresa: 'nada', registro_modo: 'misto' },
  ],
};

test('ponto: nomes, endereço, pino confirmado × cadastral, decisor, quem paga, estado e origem', () => {
  const r = migrar(V1, new Date('2026-10-06T10:00:00Z'));
  assert.equal(r.schema_version, 2);
  const [a, b, c] = r.pontos;
  assert.equal(a.nome_fantasia, 'Lanchonete A');
  assert.equal(a.endereco_cadastral, 'Rua X, 10');
  assert.deepEqual(a.coord_confirmada, { lat: -8.06, lng: -34.87, precisao_m: 12, origem: 'checkin', em: '2026-10-05T13:00:05.000Z' });
  assert.equal(a.coord_cadastral, null);
  assert.deepEqual(a.decisor, { papel: 'dono', janela: { dias: ['1'], faixas: ['6-9', '17-20'] }, atualizado_em: '2026-10-05T13:00:00.000Z' });
  assert.equal(a.quem_paga, 'outro');
  assert.equal(a.status_dia, 'retornar');
  assert.equal(a.origem, 'campo');
  assert.equal(a.origem_v1, 'lista');
  assert.deepEqual(b.coord_cadastral, { lat: -8.07, lng: -34.88 });
  assert.equal(b.coord_confirmada, null);
  assert.equal(b.estado, 'recorrente');
  assert.equal(b.estado_v1, 'cliente');
  assert.equal(b.ficticio, true);
  assert.equal(c.estado, 'cadastrado_sem_compra');
  assert.equal(c.coord_cadastral, null);
  assert.equal(r.eventos.filter((e) => e.causa === 'migracao').length, 3);
});

test('visita: mantém caminhos da V1, registro_modo vira nota_origem e ganha tempos', () => {
  const r = migrar(V1, new Date('2026-10-06T10:00:00Z'));
  const v = r.visitas[0];
  assert.equal(v.checkin.em, '2026-10-05T13:00:00.000Z');
  assert.equal(v.nucleo.resultado, 'aberto_sem_decisor');
  assert.equal(v.pesquisa.papeis.quem_paga, 'outra_pessoa');
  assert.equal(v.nota_origem, 'misto');
  assert.equal('registro_modo' in v, false);
  assert.equal(v.tipo, 'aquisicao');
  assert.deepEqual(v.tempos, { no_ponto_s: 900, nucleo_s: 40, pesquisa_s: 480 });
});

test('V2 entra e sai igual; versão mais nova é recusada', () => {
  const r = migrar(V1);
  const r2 = migrar(JSON.parse(JSON.stringify(r)));
  assert.equal(r2.pontos.length, 3);
  assert.equal(r2.vendedores[0].id, 'v-voce');
  assert.throws(() => migrar({ schema_version: 3 }), /mais nova/);
  assert.throws(() => migrar({ schema_version: 1 }), /export da V1/);
});
