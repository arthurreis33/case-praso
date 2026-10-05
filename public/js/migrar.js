// Migração de formato. Função pura: recebe um export (ou o localStorage) da V1 e devolve o estado da V2.
// Nada se perde: campos da V1 sem par na V2 ficam guardados com sufixo _v1, e as visitas mantêm
// os caminhos da V1 (checkin.em, nucleo.*, pesquisa.*), que o CSV e o script de H2 continuam lendo.
import { duracoes } from './rules.js';
import { tipoVisitaPara } from './estados.js';
import { CONFIG } from './config.js';

export const SCHEMA_VERSION = 2;
export const VENDEDOR_PADRAO = 'v-voce';

const ESTADO_V1_PARA_V2 = { lead: 'lead', oportunidade: 'cadastrado_sem_compra', cliente: 'recorrente', churn: 'churn' };

export function vendedorPadrao() {
  return {
    id: VENDEDOR_PADRAO,
    nome: 'Você',
    base: { lat: -8.1003, lng: -34.8968 }, // referência no Pina/Boa Viagem; ajustável no Hoje
    jornada: { inicio: '08:00', fim: '18:00', almoco: ['12:00', '13:00'] },
    meta_pontos_semana: CONFIG.meta_pontos_semana_padrao,
    ficticio: false,
  };
}

export function metaVazia(agora = new Date()) {
  return {
    schema_version: SCHEMA_VERSION,
    criado_em: agora.toISOString(),
    ultimo_export: null,
    config: { relogio_offset_ms: 0, vendedor_id: VENDEDOR_PADRAO, modo_deslocamento: CONFIG.rota.modo_padrao, seed: null },
    plano_dia: null,
  };
}

export function estadoVazioV2(agora = new Date()) {
  return {
    ...metaVazia(agora),
    vendedores: [vendedorPadrao()],
    pontos: [], visitas: [], pedidos: [], contatos: [], eventos: [], desconhecidos: [],
  };
}

/** Aceita export V1 (schema 1 ou sem versão) ou V2. Devolve sempre o estado V2 completo. */
export function migrar(dado, agora = new Date()) {
  if (!dado || typeof dado !== 'object') throw new Error('formato inválido');
  const v = dado.schema_version ?? 1;
  if (v > SCHEMA_VERSION) throw new Error(`Export de versão mais nova (${v}).`);
  if (v === SCHEMA_VERSION) return normalizarV2(dado, agora);
  if (!Array.isArray(dado.pontos) || !Array.isArray(dado.visitas)) throw new Error('Arquivo não parece um export da V1.');
  return deV1(dado, agora);
}

function normalizarV2(d, agora) {
  const base = estadoVazioV2(agora);
  const r = { ...base, ...d, config: { ...base.config, ...(d.config || {}) } };
  for (const c of ['vendedores', 'pontos', 'visitas', 'pedidos', 'contatos', 'eventos', 'desconhecidos']) {
    if (!Array.isArray(r[c])) r[c] = [];
  }
  if (!r.vendedores.some((x) => x.id === VENDEDOR_PADRAO)) r.vendedores.unshift(vendedorPadrao());
  delete r.exportado_em;
  return r;
}

function deV1(d, agora) {
  const r = estadoVazioV2(agora);
  r.criado_em = d.criado_em || r.criado_em;
  r.ultimo_export = d.ultimo_export || null;
  r.migrado_de_v1_em = agora.toISOString();
  const visitasPorPonto = new Map();
  for (const vis of d.visitas) {
    if (!visitasPorPonto.has(vis.ponto_id)) visitasPorPonto.set(vis.ponto_id, []);
    visitasPorPonto.get(vis.ponto_id).push(vis);
  }
  for (const p of d.pontos) {
    const vs = (visitasPorPonto.get(p.id) || []).sort((a, b) => String(b.checkin?.em).localeCompare(String(a.checkin?.em)));
    const ultimaComPapel = vs.find((x) => x.pesquisa?.papeis?.quem_paga);
    const qp = ultimaComPapel?.pesquisa.papeis.quem_paga;
    const estado = ESTADO_V1_PARA_V2[p.estado] || 'lead';
    const temCoord = p.lat != null && p.lng != null;
    const confirmada = temCoord && (p.coord_fonte === 'checkin' || p.coord_fonte === 'gps_criacao');
    r.pontos.push({
      id: p.id,
      cnpj: p.cnpj || null,
      razao_social: null,
      nome_fantasia: p.nome || '',
      tipo: p.tipo || 'outro',
      mei: null,
      endereco_cadastral: p.endereco || '',
      coord_cadastral: temCoord && !confirmada ? { lat: p.lat, lng: p.lng } : null,
      coord_confirmada: confirmada
        ? { lat: p.lat, lng: p.lng, precisao_m: p.precisao_m ?? null, origem: p.coord_fonte, em: vs[0]?.checkin?.gps_em || null }
        : null,
      horario_funcionamento: null,
      decisor: p.decisor
        ? { papel: p.decisor.quem || null, janela: { dias: [...(p.decisor.dias || [])], faixas: [...(p.decisor.faixas || [])] }, atualizado_em: p.decisor.atualizado_em || null }
        : null,
      quem_paga: qp === 'decisor' ? 'decisor' : qp ? 'outro' : null,
      cadastro_em: null,
      estado,
      estado_base: estado,
      estado_v1: p.estado || null,
      etapa_funil: 0,
      origem: 'campo',
      origem_v1: p.origem || null,
      vendedor_id: VENDEDOR_PADRAO,
      status_dia: p.status_dia || 'a_visitar',
      retorno_sugerido: p.retorno_sugerido || null,
      retorno_motivo: p.retorno_motivo || null,
      planejado_em: null,
      ficticio: !!p.ficticio,
      criado_em: p.criado_em || agora.toISOString(),
      atualizado_em: agora.toISOString(),
    });
    r.eventos.push({
      id: `ev-mig-${p.id}`, ponto_id: p.id, ts: agora.toISOString(), dimensao: 'estado',
      de: p.estado || null, para: estado, causa: 'migracao', autor: 'sistema',
    });
  }
  const estadoDe = new Map(r.pontos.map((p) => [p.id, p.estado]));
  for (const vis of d.visitas) {
    const { registro_modo, ...resto } = vis;
    const novo = {
      ...resto,
      vendedor_id: VENDEDOR_PADRAO,
      tipo: tipoVisitaPara(estadoDe.get(vis.ponto_id) || 'lead'),
      planejada_para: vis.retorno_previsto?.quando || null,
      motivo_nao_avanco: null,
      proxima_acao: null,
      nota_texto: '',
      nota_origem: registro_modo || null,
      transcricao_status: null,
      campos_ia: [],
      nucleo: { resultado: null, quem_decide: null, faixas: [], dias: [], inicio: null, fim: null, editado_em: null, ...(vis.nucleo || {}) },
      pesquisa: { inicio: null, fim: null, ...(vis.pesquisa || {}) },
    };
    if (novo.checkout) novo.tempos = tempos(novo);
    r.visitas.push(novo);
  }
  return r;
}

export function tempos(v) {
  const d = duracoes(v);
  return { no_ponto_s: d.tempo_no_ponto_s, nucleo_s: d.tempo_nucleo_s, pesquisa_s: d.tempo_pesquisa_s };
}
