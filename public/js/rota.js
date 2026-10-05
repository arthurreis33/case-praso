// Roteirizador (seção 6.3): roteamento com janelas de tempo, até ~15 paradas por dia.
// Heurística no cliente, sem solver nem API paga:
//   1) construção pelo vizinho mais próximo respeitando janelas (ponderado pelos pontos esperados);
//   2) melhoria 2-opt (só aceita se continuar viável e terminar mais cedo);
//   3) inserção mais barata das que sobraram, se couberem.
// Deslocamento = haversine × tortuosidade ÷ velocidade média (moto, carro ou a pé).
// Saída: ordem, horário previsto de cada parada e a lista do que NÃO coube, com o motivo.
//
// Interface trocável: qualquer roteador com `planejar(entrada) → saída` no mesmo formato serve.
// Para VROOM/OSRM, basta um adaptador que monte o problema (jobs com time_windows e service),
// chame o serviço e devolva { ordem, nao_couberam, fim, km } — a tela não muda.
import { distanciaM } from './rules.js';

const MIN = 60000;

/**
 * entrada = {
 *   inicio: Date, fimJornada: Date, almoco: [Date, Date] | null,
 *   base: { lat, lng }, velocidade_kmh, tortuosidade, maxParadas, esperaMaxMin,
 *   paradas: [{ id, lat, lng, duracao_min, valor, janelas: [[Date, Date]], dura: bool, rotulo_janela? }]
 * }
 * Uma parada `dura` (retorno com hora marcada) TEM de entrar; as demais entram se couberem.
 */
export function planejar(e) {
  const vel = (e.velocidade_kmh * 1000) / 60; // metros por minuto
  const desloc = (a, b) => (a && b ? (distanciaM(a.lat, a.lng, b.lat, b.lng) * e.tortuosidade) / vel : 0);
  const porId = new Map(e.paradas.map((p) => [p.id, p]));
  const duras = e.paradas.filter((p) => p.dura);

  /** Simula uma sequência. Devolve o cronograma ou { erro } com o motivo da primeira inviabilidade. */
  function simular(seq) {
    let t = e.inicio.getTime();
    let pos = e.base;
    const out = [];
    let km = 0;
    for (const id of seq) {
      const p = porId.get(id);
      const d = desloc(pos, p);
      km += (d * vel) / 1000;
      const chegada = t + d * MIN;
      let inicio = chegada;
      const jan = p.janelas.find(([, b]) => b.getTime() > chegada);
      if (!jan) return { erro: 'janela', id };
      if (jan[0].getTime() > inicio) inicio = jan[0].getTime();
      const espera = (inicio - chegada) / MIN;
      if (!p.dura && espera > e.esperaMaxMin) return { erro: 'espera', id };
      // almoço: não começa nem atravessa a visita no meio do almoço
      if (e.almoco) {
        const [a0, a1] = e.almoco.map((x) => x.getTime());
        if (inicio < a1 && inicio + p.duracao_min * MIN > a0) inicio = Math.max(inicio, a1);
        if (inicio >= jan[1].getTime()) return { erro: 'janela', id };
      }
      const saida = inicio + p.duracao_min * MIN;
      out.push({ id, chegada: new Date(chegada), inicio: new Date(inicio), saida: new Date(saida), espera_min: Math.round((inicio - chegada) / MIN), desloc_min: Math.round(d) });
      t = saida;
      pos = p;
    }
    const volta = desloc(pos, e.fimBase || e.base);
    km += (volta * vel) / 1000;
    const fim = t + volta * MIN;
    if (fim > e.fimJornada.getTime()) return { erro: 'jornada', id: seq.at(-1) };
    return { ordem: out, fim: new Date(fim), km: Math.round(km * 10) / 10 };
  }

  const viavel = (seq) => {
    const r = simular(seq);
    if (r.erro) return null;
    // as duras ainda não colocadas têm de continuar alcançáveis
    return r;
  };

  // ---------- 1) construção: vizinho mais próximo com janelas ----------
  let seq = [];
  const restantes = new Set(e.paradas.map((p) => p.id));
  const motivo = new Map();
  while (seq.length < e.maxParadas && restantes.size) {
    const atual = seq.length ? porId.get(seq.at(-1)) : e.base;
    const sim0 = seq.length ? simular(seq) : { fim: e.inicio, ordem: [] };
    const tAgora = seq.length ? sim0.ordem.at(-1).saida.getTime() : e.inicio.getTime();
    let melhor = null;
    for (const id of restantes) {
      const p = porId.get(id);
      const r = simular([...seq, id]);
      if (r.erro) { motivo.set(id, r.erro); continue; }
      // não pode inviabilizar uma dura que ainda falta
      const quebraDura = duras.some((h) => h.id !== id && restantes.has(h.id) && simular([...seq, id, h.id]).erro && !simular([...seq, h.id]).erro);
      if (quebraDura) { motivo.set(id, 'dura'); continue; }
      const custo = (r.ordem.at(-1).inicio.getTime() - tAgora) / MIN + desloc(atual, p) * 0.2;
      const urg = p.dura ? Math.max(0, (p.janelas[0][1].getTime() - tAgora) / MIN) : null;
      // dura com pouca folga vai na frente; senão, minutos gastos por ponto esperado
      const score = p.dura && urg < 45 ? -1e6 + urg : custo / (Math.max(0.05, p.valor) + (p.dura ? 2 : 0));
      if (!melhor || score < melhor.score) melhor = { id, score };
    }
    if (!melhor) break;
    seq.push(melhor.id);
    restantes.delete(melhor.id);
  }

  // ---------- 2) melhoria 2-opt ----------
  let atual = viavel(seq);
  let melhorou = true;
  let voltas = 0;
  while (melhorou && atual && voltas++ < 30) {
    melhorou = false;
    for (let i = 0; i < seq.length - 1; i++) {
      for (let k = i + 1; k < seq.length; k++) {
        const nova = [...seq.slice(0, i), ...seq.slice(i, k + 1).reverse(), ...seq.slice(k + 1)];
        const r = viavel(nova);
        if (r && r.fim < atual.fim - 1000) { seq = nova; atual = r; melhorou = true; }
      }
    }
  }

  // ---------- 3) inserção mais barata do que sobrou ----------
  const sobra = [...restantes].sort((a, b) => (porId.get(b).dura - porId.get(a).dura) || porId.get(b).valor - porId.get(a).valor);
  for (const id of sobra) {
    if (seq.length >= e.maxParadas && !porId.get(id).dura) { motivo.set(id, motivo.get(id) || 'cheia'); continue; }
    let melhor = null;
    for (let i = 0; i <= seq.length; i++) {
      const nova = [...seq.slice(0, i), id, ...seq.slice(i)];
      const r = viavel(nova);
      if (r && (!melhor || r.fim < melhor.r.fim)) melhor = { nova, r };
    }
    if (melhor) { seq = melhor.nova; atual = melhor.r; restantes.delete(id); }
  }

  const resultado = atual || { ordem: [], fim: e.inicio, km: 0 };
  return {
    ordem: resultado.ordem,
    fim: resultado.fim,
    km: resultado.km,
    nao_couberam: [...restantes].map((id) => ({ id, motivo: textoMotivo(motivo.get(id) || (seq.length >= e.maxParadas ? 'cheia' : 'jornada'), porId.get(id), e) })),
  };
}

function textoMotivo(cod, p, e) {
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  switch (cod) {
    case 'janela': return p.janelas.length ? `janela ${p.rotulo_janela || `até ${hm(p.janelas.at(-1)[1])}`} não dá na rota` : 'sem janela aberta hoje';
    case 'espera': return `teria de esperar mais de ${e.esperaMaxMin} min a janela abrir`;
    case 'jornada': return 'não dá para voltar à base dentro da jornada';
    case 'dura': return 'atrapalharia um retorno com hora marcada';
    case 'cheia': return `lista cheia (${e.maxParadas} paradas)`;
    default: return cod;
  }
}

export const ROTEADOR = { nome: 'heurística vizinho mais próximo + 2-opt', planejar };
