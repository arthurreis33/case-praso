// Próxima ação sugerida ao fim da visita (seção 6.7). Função pura: o vendedor só confirma com um toque.
// Toda sugestão vem com o porquê.
import { proximaOcorrencia, faixasFuncionamento } from './rules.js';
import { DIA_MS } from './estados.js';

const em = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const amanha = (agora) => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);

/** Primeiro horário "aberto" do ponto a partir de amanhã (abertura + 1h). */
function proximaAbertura(p, agora) {
  const [a] = faixasFuncionamento(p)[0] || [8 * 60];
  const d = amanha(agora);
  return em(d, Math.floor((a + 60) / 60), (a + 60) % 60);
}

/**
 * @param v       visita (nucleo.resultado, nucleo.faixas/dias, tipo)
 * @param p       ponto (decisor, tipo, horario_funcionamento)
 * @param ctx     { agora: Date, cadastroNaVisita: bool, sit: situação do motor }
 * @returns { tipo, data_hora, porque } | null
 */
export function sugerirProximaAcao(v, p, { agora, cadastroNaVisita = false, sit = null }) {
  const r = v.nucleo?.resultado;
  const faixas = v.nucleo?.faixas?.length ? v.nucleo.faixas : p.decisor?.janela?.faixas || [];
  const dias = v.nucleo?.faixas?.length ? v.nucleo.dias : p.decisor?.janela?.dias || [];
  const naJanela = (aPartirDe) => (faixas.length ? proximaOcorrencia(aPartirDe, faixas, dias) : null);

  if (cadastroNaVisita) {
    const q = naJanela(amanha(agora)) || em(amanha(agora), 10);
    return { tipo: 'acompanhar_1a_compra', data_hora: q.toISOString(), porque: 'cadastro feito: acompanhe a 1ª compra no app' };
  }
  if (!r) return null;
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
