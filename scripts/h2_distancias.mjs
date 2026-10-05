// H2 · "o pino errado é problema de dado, não de mapa".
// Lê o export JSON da V1, busca o endereço cadastral de cada CNPJ (BrasilAPI), geocodifica
// esse endereço (Nominatim/OpenStreetMap) e mede a distância até o GPS do check-in.
// Roda no computador, depois do campo, em lote. Fica fora do app de propósito: tira duas
// integrações externas do caminho crítico da visita.
//
// Uso:  node scripts/h2_distancias.mjs caminho/do/export.json [saida.csv]
// Saída: CSV com uma linha por ponto que tem CNPJ e check-in com GPS.
// Limite: Nominatim pede no máximo 1 requisição por segundo; o script respeita isso.
import fs from 'node:fs';
import { distanciaM } from '../public/js/rules.js';

const [, , entrada, saida = 'h2_resultado.csv'] = process.argv;
if (!entrada) { console.error('Uso: node scripts/h2_distancias.mjs export.json [saida.csv]'); process.exit(1); }

const dado = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const UA = 'praso-campo-v1-h2 (case RevOps; uso pontual)';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function enderecoCnpj(cnpj) {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`BrasilAPI ${r.status}`);
  const j = await r.json();
  return {
    texto: [j.descricao_tipo_de_logradouro, j.logradouro, j.numero, j.bairro, j.municipio, j.uf, j.cep].filter(Boolean).join(', '),
    query: { street: `${j.numero || ''} ${j.descricao_tipo_de_logradouro || ''} ${j.logradouro || ''}`.trim(), city: j.municipio, state: j.uf, postalcode: j.cep, country: 'Brasil' },
    situacao: j.descricao_situacao_cadastral,
  };
}

async function geocodificar(q) {
  const u = new URL('https://nominatim.openstreetmap.org/search');
  Object.entries({ ...q, format: 'jsonv2', limit: '1', addressdetails: '0' }).forEach(([k, v]) => v && u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const [hit] = await r.json();
  return hit ? { lat: +hit.lat, lng: +hit.lon, nivel: hit.addresstype || hit.type } : null;
}

const linhas = [['ponto_id', 'nome', 'cnpj', 'situacao', 'endereco_cnpj', 'geocode_nivel', 'gps_lat', 'gps_lng', 'gps_precisao_m', 'cnpj_lat', 'cnpj_lng', 'distancia_m', 'acima_100m', 'erro']];
for (const p of dado.pontos) {
  if (!p.cnpj || p.ficticio) continue;
  // melhor GPS = check-in de menor erro deste ponto
  const vs = dado.visitas.filter((v) => v.ponto_id === p.id && v.checkin?.lat != null)
    .sort((a, b) => a.checkin.precisao_m - b.checkin.precisao_m);
  if (!vs.length) continue;
  const g = vs[0].checkin;
  const l = { ponto_id: p.id, nome: p.nome, cnpj: p.cnpj, gps_lat: g.lat, gps_lng: g.lng, gps_precisao_m: g.precisao_m };
  try {
    const e = await enderecoCnpj(p.cnpj);
    Object.assign(l, { situacao: e.situacao, endereco_cnpj: e.texto });
    await espera(1100);
    const c = await geocodificar(e.query);
    if (!c) throw new Error('endereço não geocodificado');
    const d = distanciaM(g.lat, g.lng, c.lat, c.lng);
    Object.assign(l, { geocode_nivel: c.nivel, cnpj_lat: c.lat, cnpj_lng: c.lng, distancia_m: d, acima_100m: d > 100 ? 'sim' : 'nao' });
  } catch (err) { l.erro = err.message; }
  linhas.push(linhas[0].map((k) => l[k] ?? ''));
  console.log(`${p.nome}: ${l.distancia_m ?? '–'} m ${l.erro ? `(${l.erro})` : ''}`);
  await espera(1100);
}
const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x));
fs.writeFileSync(saida, '﻿' + linhas.map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n');
const ok = linhas.slice(1).filter((r) => r[11] !== '');
const acima = ok.filter((r) => r[12] === 'sim').length;
console.log(`\n${ok.length} pontos medidos · ${acima} a mais de 100 m do lugar real · arquivo: ${saida}`);
