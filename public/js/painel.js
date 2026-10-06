// Métricas dos painéis (seção 6.10). Funções puras sobre o store; a equipe fictícia é determinística.
import { pontosValor } from './rules.js';
import { DIA_MS } from './estados.js';
import { FAIXAS, MOTIVOS_NAO_AVANCO } from './catalogo.js';
import { rng } from './seed.js';
import { CONFIG } from './config.js';
import { motivoDaVisita } from './proxima.js';

const FAIXA = Object.fromEntries(FAIXAS.map(([k, , a, b]) => [k, [a, b]]));
export const ETAPAS_CURTAS = ['Planejada', 'Visitada', 'Decisor', 'Cadastro', '1ª compra', '3ª pelo app'];

/** Início da semana (segunda 00h) do relógio do store. */
export function inicioSemana(agora) {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dow = (d.getDay() + 6) % 7;
  return new Date(d.getTime() - dow * DIA_MS);
}

/** Pontos conquistados na semana: estabelecimentos que viraram recorrentes (PREMISSA "conquistado"). */
export function pontosSemana(store) {
  const ini = inicioSemana(store.agora()).toISOString();
  const fim = store.agora().toISOString();
  const meus = new Set(store.meusPontos().map((p) => p.id));
  const conquistas = store.estado.eventos.filter((e) => e.dimensao === 'estado' && e.para === CONFIG.conquista_em && e.ts >= ini && e.ts <= fim && meus.has(e.ponto_id));
  const vistos = new Set();
  const itens = [];
  for (const e of conquistas) {
    if (vistos.has(e.ponto_id)) continue;
    vistos.add(e.ponto_id);
    const p = store.ponto(e.ponto_id);
    itens.push({ p, pontos: pontosValor(p), ts: e.ts });
  }
  return { total: itens.reduce((s, x) => s + x.pontos, 0), itens, meta: store.vendedor().meta_pontos_semana };
}

/** Quantos pontos chegaram a cada etapa (≥ k) e a taxa de passagem k → k+1. */
export function funilDe(contagens) {
  const taxas = contagens.slice(0, -1).map((n, i) => (n ? contagens[i + 1] / n : null));
  return { contagens, taxas, total: contagens[0] ? contagens.at(-1) / contagens[0] : null };
}

export function meuFunil(store) {
  const ps = store.meusPontos();
  return funilDe([1, 2, 3, 4, 5, 6].map((k) => ps.filter((p) => (p.etapa_funil || 0) >= k).length));
}

/** Retorno "na janela": a revisita aconteceu na janela do decisor ou a até 60 min do horário sugerido. */
export function retornoNaJanela(v, ponto) {
  if (!v.retorno_previsto?.quando) return null;
  const ck = new Date(v.checkin.em);
  if (Math.abs(ck - new Date(v.retorno_previsto.quando)) <= 60 * 60000) return true;
  const m = ck.getHours() * 60 + ck.getMinutes();
  const faixas = ponto?.decisor?.janela?.faixas || [];
  return faixas.some((f) => FAIXA[f] && m >= FAIXA[f][0] && m < FAIXA[f][1]);
}

export function meuComportamento(store, dias = 60) {
  const vid = store.estado.config.vendedor_id;
  const desde = store.agora().getTime() - dias * DIA_MS;
  const vs = store.estado.visitas.filter((v) => (v.vendedor_id || 'v-voce') === vid && new Date(v.checkin.em).getTime() >= desde);
  const med = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const revisitas = vs.map((v) => retornoNaJanela(v, store.ponto(v.ponto_id))).filter((x) => x != null);
  const horas = vs.map((v) => { const d = new Date(v.checkin.em); return d.getHours() + d.getMinutes() / 60; });
  return {
    n: vs.length,
    hora_media: med(horas),
    no_ponto_min: med(vs.map((v) => v.tempos?.no_ponto_s).filter((x) => x > 0).map((x) => x / 60)),
    retorno_janela: revisitas.length ? revisitas.filter(Boolean).length / revisitas.length : null,
    n_revisitas: revisitas.length,
    voz: vs.filter((v) => v.nota_origem).length ? vs.filter((v) => v.nota_origem === 'voz' || v.nota_origem === 'misto').length / vs.filter((v) => v.nota_origem).length : null,
    nucleo_s: med(vs.map((v) => v.tempos?.nucleo_s).filter((x) => x > 0)),
    no_ponto_pct: vs.filter((v) => v.nucleo?.fim && v.checkout).length ? vs.filter((v) => v.nucleo?.fim && v.checkout && v.nucleo.fim <= v.checkout.em).length / vs.filter((v) => v.nucleo?.fim && v.checkout).length : null,
  };
}

// ---------- V2.2 · por que não avançou (etapa decisor → cadastro) ----------
const ORDEM_MOTIVO = Object.fromEntries(MOTIVOS_NAO_AVANCO.map(([k], i) => [k, i]));
// Motivos que dependem da hora e do jeito da visita (o vendedor muda); os outros são do cliente.
export const MOTIVOS_EXECUCAO = ['sem_tempo', 'vai_pensar', 'desconfia_app'];

/** Contagem dos motivos de não avanço do vendedor nos últimos `dias`: { chave: n }. */
export function meusMotivos(store, dias = 60) {
  const vid = store.estado.config.vendedor_id;
  const desde = store.agora().getTime() - dias * DIA_MS;
  const cont = {};
  for (const v of store.estado.visitas) {
    if ((v.vendedor_id || 'v-voce') !== vid || new Date(v.checkin.em).getTime() < desde) continue;
    const m = motivoDaVisita(v);
    if (m) cont[m.chave] = (cont[m.chave] || 0) + 1;
  }
  return cont;
}

/** Os `n` motivos mais frequentes: [[chave, n], …], empate na ordem do catálogo. */
export const topMotivos = (cont, n = 3) => Object.entries(cont)
  .sort((a, b) => b[1] - a[1] || (ORDEM_MOTIVO[a[0]] ?? 99) - (ORDEM_MOTIVO[b[0]] ?? 99)).slice(0, n);

/** Fração das perdas por motivo de execução. */
export function fracaoExecucao(cont) {
  const tot = Object.values(cont).reduce((s, x) => s + x, 0);
  return tot ? MOTIVOS_EXECUCAO.reduce((s, k) => s + (cont[k] || 0), 0) / tot : null;
}

// Equipe fictícia: quem converte mais perde mais por motivo do cliente (já tem fornecedor, preço);
// quem converte menos perde mais por execução (sem tempo, vai pensar, desconfia de app). PALPITE (V2.2).
const PESO_MOTIVO = {
  tem_fornecedor: (f) => 20 + 12 * f, preco: (f) => 14 + 4 * f, quer_prazo: (f) => 10 + 2 * f,
  desconfia_app: (f) => 18 - 12 * f, sem_tempo: (f) => 22 - 18 * f, vai_pensar: (f) => 20 - 14 * f,
  nao_icp: () => 5, outro: () => 4,
};
function motivosFicticios(n, f, r) {
  const pesos = Object.entries(PESO_MOTIVO).map(([k, w]) => [k, w(f) * (0.85 + 0.3 * r())]);
  const tot = pesos.reduce((s, [, w]) => s + w, 0);
  const brutos = pesos.map(([k, w]) => [k, (n * w) / tot]);
  const cont = Object.fromEntries(brutos.map(([k, x]) => [k, Math.floor(x)]));
  let resto = n - Object.values(cont).reduce((s, x) => s + x, 0);
  for (const [k] of [...brutos].sort((a, b) => (b[1] % 1) - (a[1] % 1))) { if (resto-- <= 0) break; cont[k]++; }
  return cont;
}

/** Recompras em risco: ativação perto dos 45 dias ou recorrente passando do próprio ciclo de compra. */
export function recomprasEmRisco(store) {
  const r = [];
  for (const p of store.meusPontos()) {
    const s = store.situacao(p.id);
    if (s.estado === 'ativacao' && s.prazo.dias_restantes <= 10) r.push({ p, s, texto: `${s.compras_ciclo}/3 · ${s.prazo.texto}`, urg: s.prazo.dias_restantes });
    else if (s.estado === 'recorrente' && s.prazo?.dias >= 30) r.push({ p, s, texto: `${s.prazo.dias} dias sem comprar · churn em ${s.prazo.dias_para_churn}`, urg: s.prazo.dias_para_churn });
  }
  return r.sort((a, b) => a.urg - b.urg);
}

/**
 * Equipe FICTÍCIA para o painel do gestor (6 vendedores com "Você").
 * Desenhada para a pergunta do painel: por que alguns convertem o dobro? Os de cima têm retornos na
 * janela do decisor, visita fora do pico e registro curto e por voz. Determinística.
 */
export function equipeFicticia() {
  const r = rng(777);
  const rm = rng(778); // V2.2: motivos com semente própria, para não mexer nos números que já existiam
  const perfis = [
    { id: 'v-b', nome: 'Vendedor B', forca: 1.0 },
    { id: 'v-c', nome: 'Vendedor C', forca: 0.92 },
    { id: 'v-d', nome: 'Vendedor D', forca: 0.62 },
    { id: 'v-e', nome: 'Vendedor E', forca: 0.5 },
    { id: 'v-f', nome: 'Vendedor F', forca: 0.42 },
  ];
  return perfis.map(({ id, nome, forca: f }) => {
    const j = (x, a = 0.04) => Math.max(0.02, Math.min(0.98, x + (r() - 0.5) * a));
    const taxas = [j(0.78 + 0.12 * f), j(0.42 + 0.3 * f), j(0.45 + 0.25 * f), j(0.5 + 0.25 * f), j(0.35 + 0.35 * f)];
    const c = [160 + r.int(-20, 20)];
    taxas.forEach((t) => c.push(Math.round(c.at(-1) * t)));
    return {
      id, nome, ficticio: true,
      funil: funilDe(c),
      motivos: motivosFicticios(c[2] - c[3], f, rm), // perdas entre decisor e cadastro
      comportamento: {
        n: c[0],
        hora_media: 10.2 + (1 - f) * 0.4 + (r() - 0.5) * 0.6,
        no_ponto_min: 13 + (1 - f) * 7 + (r() - 0.5) * 3,
        retorno_janela: j(0.35 + 0.5 * f, 0.08),
        voz: j(0.2 + 0.55 * f, 0.1),
        nucleo_s: 24 + (1 - f) * 50 + (r() - 0.5) * 8,
        no_ponto_pct: j(0.55 + 0.4 * f, 0.06),
      },
    };
  });
}

/** Quartil de cima: média, etapa a etapa, dos vendedores no quartil de cima da conversão total. */
export function quartilDeCima(equipe) {
  const ord = [...equipe].sort((a, b) => (b.funil.total ?? 0) - (a.funil.total ?? 0));
  const n = Math.max(1, Math.round(ord.length / 4));
  const top = ord.slice(0, n);
  const taxas = top[0].funil.taxas.map((_, i) => top.reduce((s, x) => s + (x.funil.taxas[i] ?? 0), 0) / top.length);
  return { nomes: top.map((x) => x.nome), taxas };
}
