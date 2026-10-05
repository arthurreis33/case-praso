// Histórico de compras do ponto (ficha de churn, recompra e mensagens). Funções puras.
import { DIA_MS } from './estados.js';
import { rotuloCategoria } from './demo/catalogo.js';

export function resumoCompras(pedidos) {
  const ps = [...pedidos].sort((a, b) => a.data.localeCompare(b.data));
  if (!ps.length) return null;
  const total = ps.reduce((s, p) => s + (p.valor || 0), 0);
  const intervalos = ps.slice(1).map((p, i) => (new Date(p.data) - new Date(ps[i].data)) / DIA_MS);
  const porItem = new Map();
  const porCat = new Map();
  for (const p of ps) {
    for (const it of p.itens || []) {
      const a = porItem.get(it.sku) || { sku: it.sku, nome: it.nome, categoria: it.categoria, qtd: 0, valor: 0, pedidos: 0 };
      a.qtd += it.qtd || 0; a.valor += it.valor || 0; a.pedidos += 1;
      porItem.set(it.sku, a);
      porCat.set(it.categoria, (porCat.get(it.categoria) || 0) + (it.valor || 0));
    }
  }
  const topItens = [...porItem.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const topCategorias = [...porCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ categoria: c, rotulo: rotuloCategoria(c), valor: v, share: v / total }));
  // o que parou de comprar: categorias presentes antes e ausentes nos 3 últimos pedidos
  let parou = [];
  if (ps.length >= 5) {
    const ult = new Set(ps.slice(-3).flatMap((p) => (p.itens || []).map((i) => i.categoria)));
    const antes = new Map();
    for (const p of ps.slice(0, -3)) for (const i of p.itens || []) antes.set(i.categoria, (antes.get(i.categoria) || 0) + 1);
    parou = [...antes.entries()].filter(([c, n]) => !ult.has(c) && n >= 2).sort((a, b) => b[1] - a[1]).map(([c]) => ({ categoria: c, rotulo: rotuloCategoria(c) }));
  }
  const formas = new Map();
  ps.forEach((p) => formas.set(p.forma_pagamento, (formas.get(p.forma_pagamento) || 0) + 1));
  const forma = [...formas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    n: ps.length,
    total,
    ticket_medio: total / ps.length,
    frequencia_dias: intervalos.length ? intervalos.reduce((s, x) => s + x, 0) / intervalos.length : null,
    primeira: ps[0].data,
    ultima: ps.at(-1).data,
    ultimo_pedido: ps.at(-1),
    top_itens: topItens,
    top_categorias: topCategorias,
    parou_de_comprar: parou,
    forma_pagamento: forma,
    autonomos: ps.filter((p) => p.autonomo).length,
  };
}

export const FORMAS_PAGAMENTO_ROTULO = { pix: 'PIX', boleto_vista: 'Boleto à vista', boleto_prazo: 'Boleto a prazo', cartao: 'Cartão', dinheiro_pix: 'Dinheiro ou PIX' };
