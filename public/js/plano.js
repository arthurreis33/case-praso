// Plano do dia: junta o motor de sugestão (prioridade.js) e o roteirizador (rota.js).
//  1) pontua todos os pontos da carteira para o dia (pontos esperados + motivo);
//  2) escolhe os candidatos: retornos com hora (obrigatórios) + os melhores até 15;
//     V2.3: cliente em ativação não entra como sugestão (vai por mensagem), salvo se a mensagem não gerou pedido;
//  3) roteiriza com janelas (funcionamento ∩ decisor, almoço, jornada, volta à base);
//  4) repontua cada parada com a hora prevista de chegada (pico, janela) para o motivo final.
import { CONFIG, min } from './config.js';
import { faixasFuncionamento, coordDe } from './rules.js';
import { avaliarPrioridade, janelasDecisor, textoMotivo } from './prioridade.js';
import { ROTEADOR } from './rota.js';
import { DIA_MS } from './estados.js';
import { FAIXAS, rotulo } from './catalogo.js';

const z = (n) => String(n).padStart(2, '0');
export const chaveDia = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const naHora = (dia, m) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(m / 60), m % 60);

/** Duração da visita por tipo: média medida no RF11 (≥ 3 visitas), senão o padrão configurado. */
export function duracoesMedidas(store, cfg = CONFIG) {
  const por = {};
  for (const v of store.estado.visitas) {
    const s = v.tempos?.no_ponto_s;
    if (!s || s < 60 || s > 3 * 3600) continue;
    (por[v.tipo || 'aquisicao'] ||= []).push(s / 60);
  }
  const r = {};
  for (const t of Object.keys(cfg.duracao_visita_min)) {
    const xs = por[t] || [];
    r[t] = xs.length >= cfg.min_amostras_duracao
      ? { min: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), fonte: `média de ${xs.length} visitas` }
      : { min: cfg.duracao_visita_min[t], fonte: 'padrão' };
  }
  return r;
}

const tipoVisita = (estado) => (estado === 'churn' ? 'reconquista' : ['ativacao', 'recorrente', 'ativacao_vencida'].includes(estado) ? 'acompanhamento' : 'aquisicao');

/** Dia do plano: hoje, ou amanhã se a jornada já está no fim. */
export function diaDoPlano(store) {
  const agora = store.agora();
  const j = store.vendedor().jornada;
  const fim = naHora(agora, min(j.fim));
  if (agora.getTime() > fim.getTime() - 90 * 60000) {
    const d = new Date(agora.getTime() + DIA_MS);
    return { dia: d, inicio: naHora(d, min(j.inicio)), amanha: true };
  }
  return { dia: agora, inicio: new Date(Math.max(agora.getTime(), naHora(agora, min(j.inicio)).getTime())), amanha: false };
}

/**
 * Gera (ou regenera) o plano.
 * opts: { removidos, adicionados, origem: {lat,lng} (replanejar daqui), inicio: Date, feitos: [ids] }
 */
export function gerarPlano(store, opts = {}, cfg = CONFIG) {
  const vend = store.vendedor();
  const { dia, inicio: inicioPadrao, amanha } = diaDoPlano(store);
  const inicio = opts.inicio || inicioPadrao;
  const j = vend.jornada;
  const modo = store.estado.config.modo_deslocamento || cfg.rota.modo_padrao;
  const removidos = new Set(opts.removidos || []);
  const adicionados = new Set(opts.adicionados || []);
  const feitos = new Set(opts.feitos || []);
  const dur = duracoesMedidas(store, cfg);

  // 1) pontuação
  const avaliados = [];
  for (const p of store.meusPontos()) {
    if (removidos.has(p.id) || feitos.has(p.id)) continue;
    const c = coordDe(p);
    if (!c) continue;
    const a = avaliarPrioridade(store, p, { dia });
    avaliados.push({ p, a, c });
  }
  // 2) candidatos
  const duros = avaliados.filter(({ a }) => a.retornoHoje && !a.bloqueio && a.retornoHoje.getTime() + cfg.rota.folga_retorno_min * 60000 > inicio.getTime());
  const fixos = avaliados.filter(({ p }) => adicionados.has(p.id) && !duros.some((d) => d.p.id === p.id));
  const resto = avaliados
    .filter(({ p, a }) => !a.bloqueio && a.esperados > 0.02 && !duros.some((d) => d.p.id === p.id) && !adicionados.has(p.id))
    .filter(({ a }) => a.sit.estado !== 'ativacao' || a.visitaAposMensagem) // V2.3
    .sort((x, y) => y.a.esperados - x.a.esperados)
    .slice(0, Math.max(0, cfg.rota.max_candidatos - duros.length - fixos.length));
  const candidatos = [...duros, ...fixos, ...resto];

  // 3) janelas e roteirização
  const paradas = candidatos.map(({ p, a, c }) => {
    const func = faixasFuncionamento(p);
    const dec = janelasDecisor(p, dia);
    let jan;
    let rotJan = null;
    if (a.retornoHoje) {
      const t = a.retornoHoje.getTime();
      jan = [[new Date(t), new Date(t + cfg.rota.folga_retorno_min * 60000)]];
      rotJan = `do retorno às ${z(a.retornoHoje.getHours())}:${z(a.retornoHoje.getMinutes())}`;
    } else {
      // funcionamento ∩ janela do decisor (se houver hoje); sem interseção, vale o funcionamento
      const inter = [];
      for (const [fa, fb] of func) for (const [da, db] of dec) { const x = Math.max(fa, da), y = Math.min(fb, db); if (y - x >= 20) inter.push([x, y]); }
      const base = inter.length ? inter : func;
      if (inter.length) rotJan = `do decisor (${p.decisor.janela.faixas.map((f) => rotulo(FAIXAS, f)).join(', ')})`;
      jan = base.map(([x, y]) => [naHora(dia, x), naHora(dia, y)]).sort((u, v) => u[0] - v[0]);
    }
    return {
      id: p.id, lat: c.lat, lng: c.lng, valor: a.esperados || 0.01, dura: !!a.retornoHoje,
      duracao_min: dur[tipoVisita(a.sit.estado)].min, janelas: jan, rotulo_janela: rotJan,
    };
  });
  const origem = opts.origem || vend.base;
  const r = ROTEADOR.planejar({
    inicio, fimJornada: naHora(dia, min(j.fim)), almoco: j.almoco ? [naHora(dia, min(j.almoco[0])), naHora(dia, min(j.almoco[1]))] : null,
    base: origem, fimBase: vend.base, velocidade_kmh: cfg.rota.velocidade_kmh[modo], tortuosidade: cfg.rota.tortuosidade,
    maxParadas: cfg.rota.max_paradas, esperaMaxMin: cfg.rota.espera_max_min, paradas,
  });
  // 4) repontua com a chegada prevista
  const porId = new Map(candidatos.map((x) => [x.p.id, x]));
  const paradasPlano = r.ordem.map((o, i) => {
    const { p } = porId.get(o.id);
    const a = avaliarPrioridade(store, p, { chegada: o.inicio, dia });
    return { id: o.id, ordem: i + 1, chegada: o.inicio.toISOString(), saida: o.saida.toISOString(), espera_min: o.espera_min, desloc_min: o.desloc_min, esperados: a.esperados, motivo: textoMotivo(a), dura: !!a.retornoHoje };
  });
  return {
    data: chaveDia(dia), amanha, gerado_em: store.agora().toISOString(), inicio: inicio.toISOString(), modo,
    fim_previsto: r.fim.toISOString(), km: r.km, roteador: ROTEADOR.nome,
    paradas: paradasPlano,
    nao_couberam: r.nao_couberam.map((x) => ({ ...x, esperados: porId.get(x.id)?.a.esperados ?? 0 })),
    removidos: [...removidos], adicionados: [...adicionados], feitos: [...feitos],
    duracoes: dur,
    esperados_total: Math.round(paradasPlano.reduce((s, x) => s + x.esperados, 0) * 10) / 10,
  };
}
