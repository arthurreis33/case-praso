// Motor de sugestão (seção 6.2). pontos_esperados = pontos_valor × chance_hoje.
// Regras transparentes e configuráveis em config.js; nada de modelo treinado.
// Toda regra que mexe na chance devolve um texto de motivo: o vendedor não segue o que não entende.
import { CONFIG, min } from './config.js';
import { pontosValor, fmtPontos, faixasFuncionamento, abreNoDia } from './rules.js';
import { FAIXAS, rotulo } from './catalogo.js';
import { DIA_MS } from './estados.js';
import { hora, dinheiro } from './ui.js';

const FAIXA = Object.fromEntries(FAIXAS.map(([k, r, a, b]) => [k, { r, a, b }]));
const minutosDe = (d) => d.getHours() * 60 + d.getMinutes();
const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hm = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;

/** Janelas do decisor no dia (minutos), respeitando os dias registrados. */
export function janelasDecisor(p, dia) {
  const j = p.decisor?.janela;
  if (!j?.faixas?.length) return [];
  if (j.dias?.length && !j.dias.map(String).includes(String(dia.getDay()))) return [];
  return j.faixas.map((f) => FAIXA[f]).filter(Boolean).map((f) => [f.a, f.b]);
}

export function emPico(p, m, cfg = CONFIG) {
  return (cfg.pico_por_tipo[p.tipo] || []).find(([a, b]) => m >= min(a) && m < min(b)) || null;
}

const cacheChurn = new WeakMap();
function limiarChurnAlto(store) {
  const chave = store.estado.pedidos;
  if (cacheChurn.has(chave)) return cacheChurn.get(chave);
  const vals = store.meusPontos().filter((p) => p.estado === 'churn').map((p) => valorMensal(store, p)).filter((v) => v > 0).sort((a, b) => a - b);
  const med = vals.length ? vals[Math.floor(vals.length / 2)] : Infinity;
  cacheChurn.set(chave, med);
  return med;
}

/** Valor médio por mês do histórico de compras. */
export function valorMensal(store, p) {
  const ps = store.pedidosDo(p.id);
  if (!ps.length) return 0;
  const total = ps.reduce((s, x) => s + (x.valor || 0), 0);
  const meses = Math.max(1, (new Date(ps[0].data) - new Date(ps.at(-1).data)) / (30 * DIA_MS));
  return total / meses;
}

/** Intervalo médio entre compras (dias), para saber quando a reposição vence. */
export function cicloReposicao(store, p) {
  const ps = store.pedidosDo(p.id).map((x) => new Date(x.data).getTime()).sort((a, b) => a - b);
  if (ps.length < 2) return null;
  return (ps.at(-1) - ps[0]) / (ps.length - 1) / DIA_MS;
}

/**
 * Avalia um ponto para hoje. `chegada` (Date) é opcional: sem ela, a janela do decisor conta se existir hoje.
 * Devolve { valor, chance, esperados, motivos[], bloqueio, retornoHoje, recompraVencendo }.
 */
export function avaliarPrioridade(store, p, { chegada = null, dia = null, sit = store.situacao(p.id), cfg = CONFIG } = {}) {
  const agora = store.agora();
  const hoje = dia || chegada || agora; // o dia avaliado (o plano pode ser de amanhã)
  const c = cfg.chance;
  const valor = pontosValor(p);
  let chance = c.base[sit.estado] ?? 0.1;
  const motivos = [`Vale ${fmtPontos(valor)} pt`];
  let bloqueio = null;
  let retornoHoje = null;
  let recompraVencendo = false;

  // ---- funcionamento ----
  if (!abreNoDia(p, hoje.getDay())) bloqueio = 'fechado hoje';
  if (chegada && !bloqueio) {
    const m = minutosDe(chegada);
    // horário registrado é regra; o padrão do tipo é palpite e perde para o que o vendedor combinou
    // (retorno marcado) ou registrou (janela do decisor)
    const registrado = !!p.horario_funcionamento?.faixas?.length;
    const combinado = p.status_dia === 'retornar' && p.retorno_sugerido && Math.abs(new Date(p.retorno_sugerido) - chegada) <= 45 * 60000;
    const naJanela = janelasDecisor(p, chegada).some(([a, b]) => m >= a && m < b);
    if (!faixasFuncionamento(p).some(([a, b]) => m >= a && m < b) && (registrado || (!combinado && !naJanela))) {
      bloqueio = `fechado às ${hora(chegada.toISOString())}`;
    }
  }

  // ---- sobe ----
  if (p.status_dia === 'retornar' && p.retorno_sugerido && mesmoDia(new Date(p.retorno_sugerido), hoje)) {
    retornoHoje = new Date(p.retorno_sugerido);
    chance *= c.sobe.retorno_hoje;
    motivos.push(`retorno combinado às ${hora(p.retorno_sugerido)}`);
  }
  const jan = janelasDecisor(p, hoje);
  if (jan.length) {
    const m = chegada ? minutosDe(chegada) : null;
    const cruza = m == null ? jan[0] : jan.find(([a, b]) => m >= a && m < b);
    if (cruza) {
      chance *= c.sobe.janela_decisor;
      motivos.push(`decisor costuma estar das ${hm(cruza[0])} às ${hm(cruza[1])}`);
    }
  }
  if (sit.estado === 'ativacao') {
    const ciclo = cicloReposicao(store, p);
    const desde = sit.ultima_compra ? (agora - new Date(sit.ultima_compra)) / DIA_MS : 0;
    if (sit.prazo.dias_restantes <= c.dias_recompra_alerta) {
      recompraVencendo = true;
      chance *= c.sobe.recompra_vencendo;
      motivos.push(`${sit.compras_ciclo}/3 compras · ${sit.prazo.texto}`);
    } else if (ciclo && desde >= ciclo * 0.9) {
      recompraVencendo = true;
      chance *= c.sobe.recompra_vencendo;
      motivos.push(`reposição vencendo (compra a cada ~${Math.round(ciclo)} dias)`);
    } else {
      motivos.push(`${sit.compras_ciclo}/3 compras`);
    }
  }
  if (sit.estado === 'churn') {
    const vm = valorMensal(store, p);
    if (vm > 0 && vm >= limiarChurnAlto(store)) {
      chance *= c.sobe.churn_historico_alto;
      motivos.push(`comprava ${dinheiro(vm)}/mês antes de sair`);
    } else {
      motivos.push(sit.prazo?.texto || 'churn');
    }
  }
  if (sit.estado === 'cadastrado_sem_compra' && p.cadastro_em) {
    motivos.push(`cadastrado há ${Math.floor((agora - new Date(p.cadastro_em)) / DIA_MS)} dias, sem 1ª compra`);
  }

  // ---- cai ----
  if (chegada) {
    const pico = emPico(p, minutosDe(chegada), cfg);
    if (pico) { chance *= c.cai.pico; motivos.push(`chega no pico (${pico[0]}–${pico[1]})`); }
  }
  const ult = store.visitasDo(p.id)[0];
  if (ult?.checkin?.em) {
    const dias = (agora - new Date(ult.checkin.em)) / DIA_MS;
    if (ult.nucleo?.resultado === 'recusou' && dias < c.dias_recusa) {
      chance *= c.cai.recusou_recente;
      motivos.push(`recusou há ${Math.max(1, Math.round(dias))} dias`);
    } else if (dias < c.dias_sem_avanco && !retornoHoje && (!p.etapa_desde || p.etapa_desde <= ult.checkin.em)) {
      chance *= c.cai.visitado_sem_avanco;
      motivos.push(`visitado há ${Math.max(1, Math.round(dias))} dias sem avanço`);
    }
  }

  if (bloqueio) chance = 0;
  chance = Math.min(1, chance);
  return { valor, chance, esperados: Math.round(valor * chance * 100) / 100, motivos, bloqueio, retornoHoje, recompraVencendo, sit };
}

/** Texto curto do motivo para o card: "Vale 3 pts · decisor das 15h às 17h · retorno combinado". */
export const textoMotivo = (a) => (a.bloqueio ? [...a.motivos, a.bloqueio] : a.motivos).join(' · ');
