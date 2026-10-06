// Peças de interface compartilhadas pelas telas: card do ponto, próxima ação, prazo.
import { PROXIMAS_ACOES, MOTIVOS_NAO_AVANCO, rotulo } from '../catalogo.js';
import { motivoDaVisita } from '../proxima.js';
import { esc, seloEstado, seloPontos, quando, mapsUrl } from '../ui.js';
import { icone } from '../icones.js';
import { pontosValor } from '../rules.js';
import { nomeDe } from '../store.js';

const SELO_MS = 8000;

/** Próxima ação do ponto: a confirmada na última visita, o retorno com hora, ou a padrão do estado. */
export function proximaAcao(store, p, sit = store.situacao(p.id)) {
  const agora = store.agora();
  const ult = store.visitasDo(p.id)[0];
  const pa = ult?.proxima_acao;
  if (p.status_dia === 'retornar' && p.retorno_sugerido) {
    const atrasado = new Date(p.retorno_sugerido) < agora;
    return { tipo: 'retorno', quando: p.retorno_sugerido, texto: atrasado ? `Retornar (atrasado: era ${quando(p.retorno_sugerido, agora)})` : `Retornar ${quando(p.retorno_sugerido, agora)}` };
  }
  // V2.2: "Não é ICP" na última visita = sem próxima ação (o ponto sai da lista do dia)
  if (motivoDaVisita(ult)?.chave === 'nao_icp') return { tipo: 'nenhuma', texto: 'Sem próxima ação: não é ICP' };
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

/** V2.2 · "Da última vez: {motivo} · {argumento}", quando a última visita teve motivo de não avanço. */
export function daUltimaVez(store, p) {
  const m = motivoDaVisita(store.visitasDo(p.id)[0]);
  if (!m) return null;
  return `Da última vez: ${rotulo(MOTIVOS_NAO_AVANCO, m.chave)}${m.argumento ? ` · ${m.argumento}` : ''}`;
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
 * Situação do ponto numa frase de vendedor (linha 2 do card): o que decide a ação hoje.
 * Devolve { texto, urgente }.
 */
export function situacao(store, p, sit = store.situacao(p.id)) {
  const agora = store.agora();
  if (p.status_dia === 'retornar' && p.retorno_sugerido) {
    const atrasado = new Date(p.retorno_sugerido) < agora;
    return { texto: atrasado ? `Volta atrasada: era ${quando(p.retorno_sugerido, agora)}` : `Volta ${quando(p.retorno_sugerido, agora)}`, urgente: atrasado };
  }
  if (sit.estado === 'ativacao') {
    return { texto: `${Math.min(sit.compras_ciclo, 3)}/3 compras · ${sit.prazo.texto}`, urgente: sit.prazo.dias_restantes <= 7 };
  }
  if (sit.estado === 'ativacao_vencida') return { texto: `Passou dos 45 dias${sit.prazo?.dias != null ? ` · ${sit.prazo.dias} dias sem comprar` : ''}`, urgente: false };
  if (sit.estado === 'churn') return { texto: sit.prazo?.texto || 'Parou de comprar', urgente: false };
  if (sit.estado === 'recorrente') return { texto: sit.prazo ? `Última compra há ${sit.prazo.dias} dias` : 'Comprando pelo app', urgente: (sit.prazo?.dias_para_churn ?? 999) <= 30 };
  if (sit.estado === 'cadastrado_sem_compra') return { texto: p.cadastro_em ? `Cadastrou há ${Math.max(0, Math.floor((agora - new Date(p.cadastro_em)) / 86400000))} dias, sem compra` : 'Cadastrado, sem compra', urgente: false };
  return { texto: p.verificar || !p.cnpj ? 'Sem CNPJ: confirmar no ponto' : '', urgente: false };
}

/** Tira do motivo o que o card já mostra (os pontos do ponto): "Vale 3 pt · decisor…" → "decisor…". */
const semValor = (m) => String(m || '').replace(/^Vale [\d,.]+ pts? ?·? ?/, '');
const maiuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/**
 * Card do ponto: no máximo 3 linhas de informação.
 *  1 · ordem, nome e hora prevista
 *  2 · estado, pontos e a situação ("2/3 compras · faltam 3 dias para a 3ª compra")
 *  3 · o porquê (no Hoje) ou a próxima ação (no resto)
 * Ações ficam ao lado (Tirar, Rota…). O card inteiro abre a ficha.
 * opts: { eta, ordem, motivo, sub, lado, semRota, ultimaVez }
 * V2.2: com `ultimaVez`, o card ganha a linha "Da última vez: …" quando a última visita teve motivo.
 */
export function cardPonto(store, p, opts = {}) {
  const sit = store.situacao(p.id);
  const st = situacao(store, p, sit);
  const pa = proximaAcao(store, p, sit);
  const vencido = p.status_dia === 'retornar' && p.retorno_sugerido && new Date(p.retorno_sugerido) < store.agora();
  // o porquê sem repetir o que a linha 2 já diz (pontos, compras, prazo, volta combinada)
  const motivo = semValor(opts.motivo).split(' · ').filter((seg) => seg
    && !(st.texto && st.texto.toLowerCase().includes(seg.toLowerCase()))
    && !/^\d\/3 compras$/.test(seg)
    && !(/^retorno combinado/.test(seg) && /^Volta/.test(st.texto))).join(' · ');
  const linha3 = [opts.sub, motivo ? maiuscula(motivo) : `Próxima: ${pa.texto}`].filter(Boolean).join(' · ');
  const ultima = opts.ultimaVez ? daUltimaVez(store, p) : null;
  return `<div class="card e-${esc(sit.estado)} ${vencido ? 'vencido' : ''}" data-ponto="${esc(p.id)}">
    <a class="corpo" href="#/ponto/${esc(p.id)}">
      <div class="linha1">
        <div class="nome">${opts.ordem != null ? `<span class="ordem">${opts.ordem}</span>` : ''}${esc(nomeDe(p))}</div>
        ${opts.eta ? `<span class="eta">${esc(opts.eta)}</span>` : ''}
      </div>
      <div class="linha2">${seloEstado(sit.estado)}${seloPontos(pontosValor(p))}${st.texto ? `<span class="situacao ${st.urgente ? 'urgente' : ''}">${esc(st.texto)}</span>` : ''}</div>
      <div class="linha3">${esc(linha3)}</div>
      ${ultima ? `<div class="ultima-vez">${esc(ultima)}</div>` : ''}
      ${seloAvanco(store, p.id)}
    </a>
    <div class="lado">
      ${opts.lado || ''}
      ${opts.semRota ? '' : `<a href="${esc(mapsUrl(p))}" target="_blank" rel="noopener" aria-label="Rota no Google Maps para ${esc(nomeDe(p))}">${icone('navegar')}<span>Rota</span></a>`}
    </div>
  </div>`;
}

/** Linha compacta (pendências do Hoje, Semana): ícone do estado, nome, um dado-chave e uma ação. */
export function linhaCompacta(store, p, { s = '', acao = '' } = {}) {
  const sit = store.situacao(p.id);
  return `<div class="linha-c" data-ponto="${esc(p.id)}">
    ${seloEstado(sit.estado, { soIcone: true })}
    <a class="corpo-c" href="#/ponto/${esc(p.id)}"><span class="t">${esc(nomeDe(p))}</span><span class="s">${s}</span></a>
    ${acao}
  </div>`;
}
