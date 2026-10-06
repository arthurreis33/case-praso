// Próxima ação sugerida ao fim da visita (seção 6.7). Função pura: o vendedor só confirma com um toque.
// Toda sugestão vem com o porquê.
import { proximaOcorrencia, faixasFuncionamento } from './rules.js';
import { DIA_MS } from './estados.js';
import { CONFIG } from './config.js';

const em = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const amanha = (agora) => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);

/** Primeiro horário "aberto" do ponto a partir de amanhã (abertura + 1h). */
function proximaAbertura(p, agora) {
  const [a] = faixasFuncionamento(p)[0] || [8 * 60];
  const d = amanha(agora);
  return em(d, Math.floor((a + 60) / 60), (a + 60) % 60);
}

/** Primeiro horário "aberto" do ponto num dia (abertura + 1h). */
function aberturaNoDia(p, dia) {
  const [a] = faixasFuncionamento(p)[0] || [8 * 60];
  return em(dia, Math.floor((a + 60) / 60), (a + 60) % 60);
}

/**
 * V2.2 · a próxima ação que vem do motivo de não avanço (regras em CONFIG.motivos).
 * Devolve null quando o motivo não tem regra própria (vale a sugestão de antes).
 */
function sugestaoDoMotivo(motivo, p, agora, naJanela, cfg) {
  const regra = cfg.motivos?.[motivo];
  const px = regra?.proxima;
  if (!px) return null;
  if (px.tipo === 'nenhuma') return { tipo: 'nenhuma', data_hora: null, porque: regra.porque };
  let q;
  if (px.janela === 'proxima') {
    q = naJanela(new Date(agora.getTime() + 60 * 60000)) || aberturaNoDia(p, amanha(agora));
  } else {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + (px.dias || 1));
    q = (px.janela && naJanela(dia)) || aberturaNoDia(p, dia);
  }
  return { tipo: px.tipo, data_hora: q.toISOString(), porque: regra.porque };
}

/**
 * @param v       visita (nucleo.resultado, nucleo.faixas/dias, tipo)
 * @param p       ponto (decisor, tipo, horario_funcionamento)
 * @param ctx     { agora: Date, cadastroNaVisita: bool, sit: situação do motor, cfg }
 * @returns { tipo, data_hora, porque } | null
 */
export function sugerirProximaAcao(v, p, { agora, cadastroNaVisita = false, sit = null, cfg = CONFIG }) {
  const r = v.nucleo?.resultado;
  const faixas = v.nucleo?.faixas?.length ? v.nucleo.faixas : p.decisor?.janela?.faixas || [];
  const dias = v.nucleo?.faixas?.length ? v.nucleo.dias : p.decisor?.janela?.dias || [];
  const naJanela = (aPartirDe) => (faixas.length ? proximaOcorrencia(aPartirDe, faixas, dias) : null);

  if (cadastroNaVisita) {
    // V2.2: o 1º pedido se faz na visita, com ele; o acompanhamento é no dia seguinte (na janela, se ela cair nesse dia)
    const d = amanha(agora);
    const j = naJanela(d);
    const q = j && j.toDateString() === d.toDateString() ? j : em(d, 10);
    return { tipo: 'acompanhar_1a_compra', data_hora: q.toISOString(), porque: 'se não pediu na visita: acompanhe a 1ª compra amanhã' };
  }
  if (!r) return null;
  // V2.2: com motivo marcado, a sugestão vem do motivo; sem motivo, segue a regra de antes
  if (pedeMotivo(r, cadastroNaVisita) && v.motivo_nao_avanco) {
    const s = sugestaoDoMotivo(v.motivo_nao_avanco, p, agora, naJanela, cfg);
    if (s) return s;
  }
  if (r === 'aberto_sem_decisor') {
    const q = naJanela(agora);
    if (q) return { tipo: 'retorno', data_hora: q.toISOString(), porque: 'decisor ausente: retorno na próxima janela dele' };
    return { tipo: 'retorno', data_hora: new Date(agora.getTime() + DIA_MS).toISOString(), porque: 'decisor ausente e sem janela: pergunte quando ele está e volte amanhã' };
  }
  if (r === 'fechado') {
    return { tipo: 'retorno', data_hora: proximaAbertura(p, agora).toISOString(), porque: 'ponto fechado: volta no próximo horário aberto' };
  }
  if (r === 'recusou') {
    return { tipo: 'retorno', data_hora: new Date(agora.getTime() + 30 * DIA_MS).toISOString(), porque: 'recusou: a prioridade cai por 3 semanas; nova tentativa em 30 dias' };
  }
  // falou com o decisor
  if (v.tipo === 'acompanhamento' && sit?.estado === 'ativacao') {
    return { tipo: 'mensagem_recompra', data_hora: em(new Date(agora.getTime() + 5 * DIA_MS), 10).toISOString(), porque: `${sit.compras_ciclo}/3 compras: mensagem de recompra antes do prazo` };
  }
  if (v.tipo === 'reconquista') {
    const q = naJanela(new Date(agora.getTime() + 6 * DIA_MS)) || em(new Date(agora.getTime() + 7 * DIA_MS), 10);
    return { tipo: 'retorno', data_hora: q.toISOString(), porque: 'reconquista: volte com a categoria que ele mais comprava' };
  }
  const q = naJanela(new Date(agora.getTime() + 2 * DIA_MS)) || em(new Date(agora.getTime() + 3 * DIA_MS), 10);
  return { tipo: 'retorno', data_hora: q.toISOString(), porque: 'falou com o decisor sem cadastro: retorno em 3 dias, na janela dele' };
}

/** O resultado é avanço? Se não for, aparece o chip de motivo. */
export const pedeMotivo = (resultado, cadastroNaVisita) =>
  resultado === 'recusou' || (resultado === 'falou_com_decisor' && !cadastroNaVisita);

/**
 * V2.2 · motivo de não avanço da visita, quando o resultado pede motivo e ele foi marcado.
 * Devolve { chave, argumento } ou null.
 */
export function motivoDaVisita(v, cfg = CONFIG) {
  const m = v?.motivo_nao_avanco;
  if (!m || !pedeMotivo(v.nucleo?.resultado, false)) return null;
  return { chave: m, argumento: cfg.motivos?.[m]?.argumento || '' };
}
