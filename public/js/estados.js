// Motor de estados (seção 5). Função PURA: recebe o ponto, os pedidos, as visitas e "hoje",
// e devolve o estado, a etapa do funil e a lista de transições com data e causa.
// Nenhum card é movido à mão: quem chama compara com o que está gravado e grava o EventoEstado.
//
// Regras (PREMISSAS a validar com o gestor estão no README):
//  lead                  → nunca se cadastrou
//  cadastrado_sem_compra → evento de cadastro, sem pedido          (rótulo "Oportunidade")
//  ativacao              → 1ª ou 2ª compra, dentro de 45 dias desde a 1ª
//  recorrente            → pedido autônomo que seja a 3ª compra do ciclo (ou posterior), em até 45 dias da 1ª
//  ativacao_vencida      → 45 dias desde a 1ª compra sem essa 3ª compra autônoma
//  churn                 → mais de 120 dias sem comprar             (rótulo "Oportunidade (churn)")
//  Uma compra a partir do churn reinicia o ciclo: volta para ativacao e o relógio dos 45 dias recomeça.
import { CONFIG } from './config.js';

export const DIA_MS = 86400000;
const t = (x) => (x == null ? null : new Date(x).getTime());
const iso = (ms) => new Date(ms).toISOString();

/**
 * @param ponto   { estado_base?, cadastro_em?, planejado_em? }
 * @param pedidos [{ data, autonomo }]
 * @param visitas [{ checkin: { em }, nucleo: { resultado } }]
 * @param hoje    Date
 */
export function avaliar(ponto, pedidos = [], visitas = [], hoje = new Date(), cfg = CONFIG.ciclo) {
  const agora = t(hoje);
  const LIM_ATIV = cfg.dias_ativacao * DIA_MS;
  const LIM_CHURN = cfg.dias_churn * DIA_MS;
  const ps = pedidos
    .filter((p) => t(p.data) <= agora)
    .sort((a, b) => t(a.data) - t(b.data));
  const cadastroMs = t(ponto.cadastro_em) ?? (ps.length ? t(ps[0].data) : null);

  let estado = 'lead';
  let desde = null;
  let cicloInicio = null; // ms da 1ª compra do ciclo atual
  let nCiclo = 0;
  let nAutonomasCiclo = 0;
  let ultima = null;
  let inicioCicloFunil = 0; // a partir de quando contam as visitas para a etapa (reinicia no churn)
  const transicoes = [];

  // Ponto migrado da V1 sem nenhum histórico de cadastro/pedido: mantém o estado declarado.
  if (cadastroMs == null && !ps.length && ponto.estado_base && ponto.estado_base !== 'lead') {
    estado = ponto.estado_base;
    desde = ponto.estado_base_desde || null;
  }

  const ir = (para, ms, causa) => {
    if (para === estado) return;
    transicoes.push({ ts: iso(ms), de: estado, para, causa });
    estado = para;
    desde = iso(ms);
    if (para === 'churn') inicioCicloFunil = ms;
  };

  // Transições por tempo até o instante `ate` (exclusivo do evento que vem nele).
  const tempoAte = (ate) => {
    if (estado === 'ativacao' && cicloInicio != null && ate > cicloInicio + LIM_ATIV) {
      ir('ativacao_vencida', cicloInicio + LIM_ATIV, 'tempo');
    }
    if (['ativacao', 'ativacao_vencida', 'recorrente'].includes(estado) && ultima != null && ate > ultima + LIM_CHURN) {
      ir('churn', ultima + LIM_CHURN, 'tempo');
    }
  };

  if (cadastroMs != null && cadastroMs <= agora) ir('cadastrado_sem_compra', cadastroMs, 'cadastro');

  for (const p of ps) {
    const ms = t(p.data);
    tempoAte(ms);
    if (['lead', 'cadastrado_sem_compra', 'churn'].includes(estado)) {
      ir('ativacao', ms, 'pedido');
      cicloInicio = ms;
      nCiclo = 1;
      nAutonomasCiclo = p.autonomo ? 1 : 0;
    } else {
      nCiclo += 1;
      if (p.autonomo) nAutonomasCiclo += 1;
      if (estado === 'ativacao' && nCiclo >= cfg.compras_para_recorrente && p.autonomo && ms <= cicloInicio + LIM_ATIV) {
        ir('recorrente', ms, 'pedido');
      }
    }
    ultima = ms;
  }
  tempoAte(agora);

  // ---------- Prazo exibido no card ----------
  let prazo = null;
  if (estado === 'ativacao') {
    const restam = Math.ceil((cicloInicio + LIM_ATIV - agora) / DIA_MS);
    prazo = { tipo: 'ativacao', dias_restantes: Math.max(0, restam), texto: `faltam ${Math.max(0, restam)} dias para os ${cfg.dias_ativacao}` };
  } else if (ultima != null && ['recorrente', 'ativacao_vencida', 'churn'].includes(estado)) {
    const dias = Math.floor((agora - ultima) / DIA_MS);
    prazo = { tipo: 'sem_comprar', dias, dias_para_churn: Math.max(0, cfg.dias_churn - dias), texto: `${dias} dias sem comprar` };
  }

  // ---------- Etapa do funil (a mais avançada do ciclo atual) ----------
  const etapa = calcularEtapa({ estado, nCiclo, ponto, visitas, inicioCicloFunil });

  return {
    estado,
    desde,
    transicoes,
    etapa,
    ciclo_inicio: cicloInicio != null ? iso(cicloInicio) : null,
    compras_ciclo: nCiclo,
    compras_autonomas_ciclo: nAutonomasCiclo,
    ultima_compra: ultima != null ? iso(ultima) : null,
    prazo,
  };
}

/**
 * Etapas 1–3 vêm do registro de visita; 4–6 vêm de eventos do sistema.
 * 0 = fora do funil no ciclo atual (nem planejado).
 */
export function calcularEtapa({ estado, nCiclo, ponto, visitas, inicioCicloFunil = 0 }) {
  if (estado === 'recorrente') return 6;
  if (estado === 'ativacao' || estado === 'ativacao_vencida') return 5;
  if (estado === 'cadastrado_sem_compra') return 4;
  const doCiclo = (visitas || []).filter((v) => v.checkin?.em && t(v.checkin.em) >= inicioCicloFunil);
  if (doCiclo.some((v) => v.nucleo?.resultado === 'falou_com_decisor')) return 3;
  if (doCiclo.some((v) => v.nucleo?.resultado && v.nucleo.resultado !== 'fechado')) return 2;
  if (ponto.planejado_em && t(ponto.planejado_em) >= inicioCicloFunil) return 1;
  return 0;
}

/** Tipo de visita inferido do estado no check-in. */
export function tipoVisitaPara(estado) {
  if (estado === 'churn') return 'reconquista';
  if (['ativacao', 'recorrente', 'ativacao_vencida'].includes(estado)) return 'acompanhamento';
  return 'aquisicao';
}
