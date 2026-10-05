// Peças de interface compartilhadas pelas telas: card do ponto, próxima ação, prazo.
import { TIPOS, PROXIMAS_ACOES, rotulo } from '../catalogo.js';
import { esc, seloEstado, seloPontos, janelaTexto, quando, mapsUrl } from '../ui.js';
import { pontosValor } from '../rules.js';
import { nomeDe } from '../store.js';

const SELO_MS = 8000;

/** Próxima ação do ponto: a confirmada na última visita, o retorno com hora, ou a padrão do estado. */
export function proximaAcao(store, p, sit = store.situacao(p.id)) {
  const agora = store.agora();
  const ult = store.visitasDo(p.id)[0];
  const pa = ult?.proxima_acao;
  if (p.status_dia === 'retornar' && p.retorno_sugerido) {
    return { tipo: 'retorno', quando: p.retorno_sugerido, texto: `Retornar ${quando(p.retorno_sugerido, agora)}` };
  }
  if (pa?.tipo && pa.tipo !== 'nenhuma' && (!pa.data_hora || new Date(pa.data_hora) >= new Date(agora.getTime() - 86400000))) {
    return { tipo: pa.tipo, quando: pa.data_hora, texto: `${rotulo(PROXIMAS_ACOES, pa.tipo)}${pa.data_hora ? ` ${quando(pa.data_hora, agora)}` : ''}` };
  }
  switch (sit?.estado) {
    case 'cadastrado_sem_compra': return { tipo: 'lembrete_1a_compra', texto: 'Lembrete de 1ª compra' };
    case 'ativacao': return { tipo: 'mensagem_recompra', texto: sit.compras_ciclo >= 2 ? 'Recompra para fechar a 3ª' : 'Recompra (2ª compra)' };
    case 'ativacao_vencida': return { tipo: 'mensagem_recompra', texto: 'Recompra' };
    case 'churn': return { tipo: 'reconquista', texto: 'Reconquista' };
    case 'recorrente': return { tipo: 'nenhuma', texto: 'Acompanhar recompra' };
    default: return { tipo: 'retorno', texto: ult ? 'Nova visita' : 'Primeira visita' };
  }
}

export function prazoHtml(sit) {
  if (!sit?.prazo) return '';
  const urg = sit.prazo.tipo === 'ativacao' ? sit.prazo.dias_restantes <= 7 : sit.prazo.dias > 90;
  return `<span class="prazo ${urg ? 'urgente' : ''}">${esc(sit.prazo.texto)}</span>`;
}

export function seloAvanco(store, pid) {
  const a = store.avancos.get(pid);
  if (!a || Date.now() - a.ts > SELO_MS) return '';
  return `<div class="selo-avanco ${a.sobe ? '' : 'desce'}" role="status">${esc(a.texto)}</div>`;
}

/**
 * Card do ponto.
 * opts: { eta, ordem, motivo, esperados, lado: html extra, sub: texto extra, semRota }
 */
export function cardPonto(store, p, opts = {}) {
  const sit = store.situacao(p.id);
  const pa = proximaAcao(store, p, sit);
  const dec = janelaTexto(p.decisor);
  const compras = sit.estado === 'ativacao' ? `<span class="selo" title="compras no ciclo">${Math.min(sit.compras_ciclo, 3)}/3</span>` : '';
  const vencido = p.status_dia === 'retornar' && p.retorno_sugerido && new Date(p.retorno_sugerido) < store.agora();
  const sub = [rotulo(TIPOS, p.tipo), p.bairro, opts.sub].filter(Boolean).join(' · ');
  return `<div class="card e-${esc(sit.estado)} ${vencido ? 'vencido' : ''}" data-ponto="${esc(p.id)}">
    <a class="corpo" href="#/ponto/${esc(p.id)}">
      <div class="linha1">
        <div class="nome">${opts.ordem != null ? `<span class="ordem">${opts.ordem}</span> ` : ''}${esc(nomeDe(p))}</div>
        ${opts.eta ? `<span class="eta">${esc(opts.eta)}</span>` : ''}
      </div>
      <div class="meta">${esc(sub)}</div>
      <div class="linha2">${seloEstado(sit.estado)}${seloPontos(pontosValor(p))}${opts.esperados != null ? seloPontos(opts.esperados, { esperados: true }) : ''}${compras}${prazoHtml(sit)}</div>
      ${dec ? `<div class="meta">Decisor: <b>${esc(dec)}</b></div>` : ''}
      <div class="meta">Próxima: <b>${esc(pa.texto)}</b></div>
      ${opts.motivo ? `<div class="motivo">${esc(opts.motivo)}</div>` : ''}
      ${seloAvanco(store, p.id)}
    </a>
    <div class="lado">
      ${opts.lado || ''}
      ${opts.semRota ? '' : `<a href="${esc(mapsUrl(p))}" target="_blank" rel="noopener" aria-label="Rota no Google Maps para ${esc(nomeDe(p))}">Rota</a>`}
    </div>
  </div>`;
}
