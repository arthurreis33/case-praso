// Regras de negócio puras (sem DOM, sem armazenamento). Testadas em tests/rules.test.mjs.
import { FAIXAS } from './catalogo.js';

const INICIO_FAIXA = Object.fromEntries(FAIXAS.map(([v, , min]) => [v, min]));

/**
 * RF10 · próxima ocorrência de uma janela (faixas × dias) estritamente depois de `agora`.
 * Sem dias marcados = qualquer dia. Se o vendedor está dentro da janela agora e o decisor
 * não estava, a sugestão é a próxima janela, não "agora".
 */
export function proximaOcorrencia(agora, faixas = [], dias = []) {
  const inicios = faixas.map((f) => INICIO_FAIXA[f]).filter((m) => m !== undefined).sort((a, b) => a - b);
  if (!inicios.length) return null;
  const diasOk = new Set((dias || []).map(String));
  for (let d = 0; d <= 7; d++) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d);
    if (diasOk.size && !diasOk.has(String(dia.getDay()))) continue;
    for (const min of inicios) {
      const c = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(min / 60), min % 60);
      if (c > agora) return c;
    }
  }
  return null;
}

/**
 * RF10 · o ponto vai sozinho para "retornar" em dois casos:
 *  1) melhor horário registrado no fechamento (pergunta 8) — tem prioridade, é a resposta explícita;
 *  2) resultado "aberto sem decisor" com janela do decisor registrada no núcleo.
 * Retorna { quando: Date, motivo } ou null.
 */
export function calcularRetorno(visita, referencia) {
  const fech = visita?.pesquisa?.fechamento?.melhor_horario;
  if (fech?.faixas?.length) {
    const quando = proximaOcorrencia(referencia, fech.faixas, fech.dias);
    if (quando) return { quando, motivo: 'melhor_horario' };
  }
  const n = visita?.nucleo;
  if (n?.resultado === 'aberto_sem_decisor' && n.faixas?.length) {
    const quando = proximaOcorrencia(referencia, n.faixas, n.dias);
    if (quando) return { quando, motivo: 'janela_decisor' };
  }
  return null;
}

const seg = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 1000) : null);

/** RF11 · durações derivadas dos horários brutos gravados na visita. */
export function duracoes(v) {
  const fimNucleo = v.nucleo?.fim;
  const saida = v.checkout?.em;
  return {
    tempo_no_ponto_s: seg(v.checkin?.em, saida),
    tempo_nucleo_s: seg(v.nucleo?.inicio, fimNucleo),
    tempo_pesquisa_s: seg(v.pesquisa?.inicio, v.pesquisa?.fim),
    // H1: o núcleo foi salvo ainda no ponto (antes do check-out)?
    nucleo_no_ponto: fimNucleo ? (saida ? new Date(fimNucleo) <= new Date(saida) : true) : null,
    // Tese do laço: quantos minutos a revisita ficou do horário sugerido
    revisita_desvio_min: v.retorno_previsto?.quando
      ? Math.round((new Date(v.checkin.em) - new Date(v.retorno_previsto.quando)) / 60000)
      : null,
  };
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, valor) {
  const ks = path.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[ks.at(-1)] = valor;
}

/** Distância em metros entre dois pontos (haversine). Usada no script de H2 e no aviso de precisão. */
export function distanciaM(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = (x) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
