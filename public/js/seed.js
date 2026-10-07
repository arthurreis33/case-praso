// Seed FICTÍCIO (seção 7.1). Gera ~210 pontos em Boa Viagem, Pina e Imbiribeira (Recife), espalhados
// por todos os estados, com pedidos e itens coerentes por tipo, churns com histórico rico,
// ativações perto dos 45 dias, decisores com e sem janela e pontos sem CNPJ.
// V2.3: o "Você" é um vendedor mediano cuja maior perda está em visitada → decisor, a etapa da aposta
// (muitas visitas com o decisor ausente e metade dos retornos fora da janela). Ver docs/PLANO_V2_3.md.
// Nomes, endereços, CNPJs e coordenadas são INVENTADOS. Os CNPJs têm dígito verificador errado
// de propósito, para nunca coincidir com uma empresa real. Nenhum dado de pessoa.
// Determinístico: a mesma semente gera os mesmos dados, relativos ao "hoje" informado.
import { PRODUTOS, PERFIL_TIPO } from './demo/catalogo.js';
import { proximaOcorrencia, pontosValor } from './rules.js';
import { DIA_MS } from './estados.js';
import { tempos } from './migrar.js';
import { sugerirProximaAcao } from './proxima.js';

export const SEED_VERSAO = 'seed-v2-3';

export function rng(semente = 42) {
  let a = semente >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (a0, b0) => Math.floor(r() * (b0 - a0 + 1)) + a0;
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.peso = (obj) => {
    const tot = Object.values(obj).reduce((s, x) => s + x, 0);
    let x = r() * tot;
    for (const [k, w] of Object.entries(obj)) { x -= w; if (x <= 0) return k; }
    return Object.keys(obj)[0];
  };
  return r;
}

// Caixas aproximadas (terra firme) de cada bairro. Só referência geográfica.
export const BAIRROS = {
  'Boa Viagem': { lat: [-8.135, -8.105], lng: [-34.910, -34.899], n: 95 },
  Pina: { lat: [-8.098, -8.086], lng: [-34.892, -34.883], n: 50 },
  Imbiribeira: { lat: [-8.125, -8.100], lng: [-34.922, -34.912], n: 65 },
};

const PREFIXO = {
  restaurante: ['Restaurante', 'Cantina', 'Self-service', 'Bistrô'],
  lanchonete: ['Lanchonete', 'Lanches', 'Pastelaria', 'Salgaderia'],
  padaria: ['Padaria', 'Panificadora', 'Pães'],
  pizzaria: ['Pizzaria', 'Forno'],
  hamburgueria: ['Hamburgueria', 'Burger', 'Smash'],
  cafeteria: ['Café', 'Cafeteria'],
  bar: ['Bar', 'Boteco', 'Bar e Petiscaria'],
  outro: ['Mercadinho', 'Empório', 'Quitanda'],
};
const NOMES = [
  'Maré Mansa', 'Sol do Pina', 'Brisa', 'Coqueiral', 'Jangada', 'Farol', 'Mangue', 'Arrecifes', 'Boa Mesa', 'Ponto Certo',
  'Sabor da Orla', 'Canto', 'Cais', 'Areia Branca', 'Dois Coqueiros', 'Bom Paladar', 'Panela Cheia', 'Vila', 'Estação',
  'Esquina', 'Recanto', 'Quintal', 'Varanda', 'Fornalha', 'Brasa', 'Trigo de Ouro', 'Pão Quente', 'Grão', 'Aroma', 'Prosa',
  'Primavera', 'Ipê', 'Cajueiro', 'Pitanga', 'Caju', 'Acerola', 'Sereia', 'Atlântico', 'Beira-Mar', 'Litoral', 'Maresia',
  'Onda', 'Rede', 'Barcaça', 'Porto', 'Âncora', 'Bússola', 'Timão', 'Vela', 'Remo', 'Pé de Serra', 'Sertão', 'Agreste',
  'Baobá', 'Gameleira', 'Maracatu', 'Frevo', 'Ciranda', 'Coco', 'Xaxado', 'Bem-te-vi', 'Sabiá', 'Sanhaçu', 'Galo',
];
const TIPOS_PESO = { restaurante: 22, lanchonete: 22, padaria: 12, bar: 12, pizzaria: 9, hamburgueria: 10, cafeteria: 8, outro: 5 };
const JANELA_TIPO = {
  restaurante: ['14-17', '9-1130'], lanchonete: ['14-17', '9-1130'], padaria: ['9-1130', '14-17'], pizzaria: ['14-17', '17-20'],
  hamburgueria: ['14-17', '17-20'], cafeteria: ['9-1130', '14-17'], bar: ['14-17', '17-20'], outro: ['9-1130', '14-17'],
};
// V2.3: o funil conta cadastrado como visitado e decisor; para o "Você" ficar perto de 57% em visitada → decisor
// com 210 pontos, a carteira tem menos pontos cadastrados e mais leads já visitados.
const ESTADOS_ALVO = { lead: 120, cadastrado_sem_compra: 19, ativacao: 15, recorrente: 33, ativacao_vencida: 3, churn: 20 };

const iso = (ms) => new Date(ms).toISOString();
const z = (n) => String(n).padStart(2, '0');

/** CNPJ fictício: dígitos verificadores calculados e depois trocados → nunca é um CNPJ válido. */
export function cnpjFicticio(r) {
  const base = Array.from({ length: 8 }, () => r.int(0, 9)).concat([0, 0, 0, 1]);
  const dv = (nums) => {
    const pesos = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = nums.reduce((acc, n, i) => acc + n * pesos[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return base.join('') + ((d1 + 1) % 10) + ((d2 + 3) % 10);
}

export function itensPedido(tipo, r, { excluir = null, n = null } = {}) {
  const perfil = { ...(PERFIL_TIPO[tipo] || PERFIL_TIPO.outro) };
  if (excluir) delete perfil[excluir];
  const qtd = n ?? r.int(2, 5);
  const its = [];
  const usados = new Set();
  for (let i = 0; i < qtd * 3 && its.length < qtd; i++) {
    const cat = r.peso(perfil);
    const opcoes = PRODUTOS.filter(([sku, , c]) => c === cat && !usados.has(sku));
    if (!opcoes.length) continue;
    const [sku, nome, categoria, preco] = r.pick(opcoes);
    usados.add(sku);
    const q = r.int(1, 4);
    its.push({ sku, nome, categoria, qtd: q, valor: Math.round(q * preco * 100) / 100 });
  }
  return its;
}

const FORMAS = { pix: 50, boleto_vista: 20, boleto_prazo: 15, cartao: 15 };

export function gerarSeed({ hoje = new Date(), semente = 20261005, vendedorId = 'v-voce' } = {}) {
  const r = rng(semente);
  const H = hoje.getTime();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const pontos = [], pedidos = [], visitas = [], contatos = [], desconhecidos = [];
  let seq = 0;
  const id = (p) => `${p}${(++seq).toString(36).padStart(4, '0')}`;
  const nomesUsados = new Set();

  // sorteia os estados na ordem embaralhada
  const fila = Object.entries(ESTADOS_ALVO).flatMap(([e, n]) => Array(n).fill(e));
  for (let i = fila.length - 1; i > 0; i--) { const j = r.int(0, i); [fila[i], fila[j]] = [fila[j], fila[i]]; }

  const bairros = Object.entries(BAIRROS).flatMap(([b, cfg]) => Array(cfg.n).fill(b));
  const nAtivPerto = { n: 0 };
  const ativPerto = []; // V2.3 · B: candidatos à "mensagem sem pedido"
  const nConquistas = { n: 0 };

  const novoNome = (tipo, bairro) => {
    for (let k = 0; k < 20; k++) {
      const nome = `${r.pick(PREFIXO[tipo])} ${r.pick(NOMES)}`;
      if (!nomesUsados.has(nome)) { nomesUsados.add(nome); return nome; }
    }
    const nome = `${r.pick(PREFIXO[tipo])} ${r.pick(NOMES)} ${bairro}`;
    nomesUsados.add(nome);
    return nome;
  };

  const horaNoDia = (diaMs, hMin, hMax) => diaMs + r.int(hMin * 60, hMax * 60) * 60000;
  const diaDe = (ms) => new Date(new Date(ms).getFullYear(), new Date(ms).getMonth(), new Date(ms).getDate()).getTime();

  function pedido(p, ms, { autonomo, excluir = null, n = null }) {
    const its = itensPedido(p.tipo, r, { excluir, n });
    const ped = {
      id: id('pd-'), ponto_id: p.id, data: iso(ms),
      valor: Math.round(its.reduce((s, i) => s + i.valor, 0) * 100) / 100,
      itens: its, forma_pagamento: r.peso(FORMAS), autonomo, assistido: !autonomo,
      pago_em: r.chance(0.9) ? iso(ms + r.int(0, 3) * DIA_MS) : null, simulado: true,
    };
    pedidos.push(ped);
    return ped;
  }

  function visita(p, ms, { resultado, tipo = 'aquisicao', faixas = [], dias = [], motivo = null, proxima = null, voz = null }) {
    const durMin = r.int(6, 24);
    const nIni = ms + r.int(1, 4) * 60000;
    // V2.2: o tempo de registro do "Você" segue a meta da H1 (< 20 s). Mediana perto de 18 s:
    // 70% entre 10 e 22 s e 30% na cauda, entre 23 e 45 s. Continua determinístico pela semente.
    const nucleoS = r.chance(0.7) ? r.int(10, 22) : r.int(23, 45);
    const v = {
      id: id('vs-'), ponto_id: p.id, vendedor_id: vendedorId, tipo, estado_no_checkin: null, planejada_para: null,
      checkin: { em: iso(ms), lat: null, lng: null, precisao_m: r.int(5, 30), gps_erro: null, gps_em: iso(ms + 4000), distancia_pino_m: r.int(3, 60) },
      checkout: { em: iso(ms + durMin * 60000) },
      retorno_previsto: null, versao_conversa: r.pick(['gatekeeper', '2min', '10min']), observacao: [],
      nucleo: { resultado, quem_decide: p.decisor?.papel || null, faixas, dias, inicio: iso(nIni), fim: iso(nIni + nucleoS * 1000), editado_em: null },
      motivo_nao_avanco: motivo, proxima_acao: proxima,
      pesquisa: { inicio: null, fim: null }, surpresa: '',
      nota_texto: '', nota_origem: voz ?? (r.chance(0.45) ? 'voz' : 'digitacao'), transcricao_status: null, campos_ia: [], ficticio: true,
    };
    const c = p.coord_confirmada || p.coord_cadastral;
    if (c) { v.checkin.lat = +(c.lat + (r() - 0.5) * 0.0004).toFixed(6); v.checkin.lng = +(c.lng + (r() - 0.5) * 0.0004).toFixed(6); }
    v.tempos = { ...tempos(v), nota_origem: v.nota_origem };
    visitas.push(v);
    return v;
  }

  for (let i = 0; i < fila.length; i++) {
    const alvo = fila[i];
    const bairro = bairros[i % bairros.length];
    const caixa = BAIRROS[bairro];
    const tipo = r.peso(TIPOS_PESO);
    const temCnpj = alvo !== 'lead' ? r.chance(0.97) : r.chance(0.72);
    const mei = temCnpj ? r.chance(0.35) : null;
    const lat = +(caixa.lat[0] + r() * (caixa.lat[1] - caixa.lat[0])).toFixed(6);
    const lng = +(caixa.lng[0] + r() * (caixa.lng[1] - caixa.lng[0])).toFixed(6);
    const nome = novoNome(tipo, bairro);
    const temDecisor = r.chance(0.55);
    const faixasJanela = temDecisor ? (r.chance(0.75) ? [JANELA_TIPO[tipo][0]] : [...JANELA_TIPO[tipo]]) : [];
    const p = {
      id: id('pt-'),
      cnpj: temCnpj ? cnpjFicticio(r) : null,
      razao_social: temCnpj ? `${nome.split(' ').slice(1).join(' ')} Comércio de Alimentos${mei ? ' MEI' : ' Ltda'} (fictícia)` : null,
      nome_fantasia: nome,
      tipo,
      mei,
      cnae: temCnpj ? { restaurante: '5611-2/01', lanchonete: '5611-2/03', padaria: '1091-1/02', pizzaria: '5611-2/01', hamburgueria: '5611-2/03', cafeteria: '5611-2/03', bar: '5611-2/05', outro: '4721-1/02' }[tipo] : null,
      situacao: temCnpj ? 'ativa' : null,
      endereco_cadastral: `Rua Projetada ${r.int(1, 60)}, ${r.int(10, 990)} · ${bairro} · Recife (endereço fictício)`,
      bairro,
      coord_cadastral: { lat, lng },
      coord_confirmada: null,
      horario_funcionamento: r.chance(0.25) ? { dias: ['1', '2', '3', '4', '5', '6'], faixas: null } : null,
      decisor: temDecisor ? {
        papel: r.peso({ dono: 60, socio: 15, gerente: 15, cozinheiro: 10 }),
        janela: { dias: r.chance(0.5) ? [] : ['1', '2', '3', '4', '5'], faixas: faixasJanela },
        atualizado_em: iso(H - r.int(5, 90) * DIA_MS),
      } : null,
      quem_paga: r.chance(0.4) ? r.pick(['decisor', 'decisor', 'outro']) : null,
      cadastro_em: null,
      estado: 'lead', etapa_funil: 0,
      origem: 'campo',
      vendedor_id: vendedorId,
      status_dia: 'a_visitar', retorno_sugerido: null, retorno_motivo: null, planejado_em: null,
      verificar: !temCnpj && r.chance(0.6),
      ficticio: true,
      criado_em: iso(H - r.int(30, 400) * DIA_MS),
      atualizado_em: iso(H),
    };
    if (p.horario_funcionamento) p.horario_funcionamento.faixas = null;
    // um pino cadastral errado de propósito em ~12% (é a queixa "pino no lugar errado")
    if (r.chance(0.12)) p.coord_cadastral = { lat: +(lat + (r() - 0.5) * 0.006).toFixed(6), lng: +(lng + (r() - 0.5) * 0.006).toFixed(6) };
    else if (r.chance(0.3)) p.coord_confirmada = { lat, lng, precisao_m: r.int(5, 25), origem: 'checkin', em: iso(H - r.int(3, 120) * DIA_MS) };

    // ---------- histórico por estado ----------
    if (alvo === 'lead') {
      p.origem = p.cnpj ? r.pick(['receita', 'receita', 'campo']) : r.pick(['mapa_aberto', 'campo']);
    } else {
      p.origem = 'base_praso';
    }

    if (alvo === 'cadastrado_sem_compra') {
      const cad = horaNoDia(diaDe(H - r.int(2, 110) * DIA_MS), 9, 17);
      p.cadastro_em = iso(cad);
      if (r.chance(0.6)) visita(p, cad - 15 * 60000, { resultado: 'falou_com_decisor' });
    }

    if (alvo === 'ativacao') {
      const perto = nAtivPerto.n < 6;
      if (perto) nAtivPerto.n++;
      const d = perto ? r.int(35, 44) : r.int(3, 30);
      const ini = horaNoDia(diaDe(H - d * DIA_MS), 9, 18);
      p.cadastro_em = iso(ini - r.int(0, 2) * DIA_MS - 3600000);
      if (r.chance(0.6)) visita(p, Date.parse(p.cadastro_em) - 20 * 60000, { resultado: 'falou_com_decisor' });
      pedido(p, ini, { autonomo: r.chance(0.2) });
      if (r.chance(0.6) && d > 6) pedido(p, ini + r.int(4, Math.max(5, d - 2)) * DIA_MS, { autonomo: r.chance(0.6) });
      // V2.3: o lembrete da 1ª compra vem antes do 1º pedido (a mensagem funcionou)
      if (r.chance(0.4)) contatos.push({ id: id('ct-'), ponto_id: p.id, ts: iso(Math.max(Date.parse(p.cadastro_em) + 3600000, ini - r.int(1, 2) * DIA_MS)), canal: 'whatsapp', modelo_mensagem: 'lembrete_1a_compra', gerado_pela_plataforma: true, vendedor_id: vendedorId });
      if (perto) ativPerto.push(p);
    }

    if (alvo === 'recorrente' && nConquistas.n < 3) {
      // conquistas recentes: viraram recorrentes nas últimas horas (alimentam "pontos da semana")
      nConquistas.n++;
      const ini = horaNoDia(diaDe(H - r.int(20, 35) * DIA_MS), 9, 18);
      p.cadastro_em = iso(ini - DIA_MS);
      pedido(p, ini, { autonomo: false });
      pedido(p, ini + r.int(6, 12) * DIA_MS, { autonomo: r.chance(0.5) });
      pedido(p, H - nConquistas.n * 2 * 3600000, { autonomo: true });
    } else if (alvo === 'recorrente') {
      const ini = horaNoDia(diaDe(H - r.int(60, 330) * DIA_MS), 9, 18);
      p.cadastro_em = iso(ini - DIA_MS);
      pedido(p, ini, { autonomo: false });
      let t = ini + r.int(5, 15) * DIA_MS;
      pedido(p, t, { autonomo: r.chance(0.7) });
      t += r.int(6, 20) * DIA_MS;
      pedido(p, t, { autonomo: true });
      const fimHist = H - r.int(1, 25) * DIA_MS;
      while (t + 6 * DIA_MS < fimHist) { t += r.int(6, 20) * DIA_MS; if (t < fimHist) pedido(p, t, { autonomo: r.chance(0.85) }); }
    }

    if (alvo === 'ativacao_vencida') {
      const ini = horaNoDia(diaDe(H - r.int(50, 110) * DIA_MS), 9, 18);
      p.cadastro_em = iso(ini - DIA_MS);
      pedido(p, ini, { autonomo: false });
      if (r.chance(0.6)) pedido(p, ini + r.int(5, 35) * DIA_MS, { autonomo: r.chance(0.5) });
    }

    if (alvo === 'churn') {
      // histórico rico: compra regular por meses, deixa de comprar uma categoria antes de sair
      const ultimaDias = r.int(125, 260);
      const n = r.int(8, 24);
      const freq = r.int(7, 16);
      const ini = horaNoDia(diaDe(H - (ultimaDias + n * freq) * DIA_MS), 9, 18);
      p.cadastro_em = iso(ini - DIA_MS);
      const perfil = Object.entries(PERFIL_TIPO[p.tipo] || PERFIL_TIPO.outro).sort((a, b) => b[1] - a[1]);
      const larga = perfil[1]?.[0] || perfil[0][0];
      let t = ini;
      for (let k = 0; k < n; k++) {
        pedido(p, t, { autonomo: k === 0 ? false : r.chance(0.85), excluir: k >= n - 3 ? larga : null, n: r.int(3, 6) });
        t += (freq + r.int(-2, 3)) * DIA_MS;
      }
      // última compra exatamente no passado combinado
      const ult = pedidos.filter((x) => x.ponto_id === p.id).at(-1);
      ult.data = iso(horaNoDia(diaDe(H - ultimaDias * DIA_MS), 9, 18));
      if (r.chance(0.3)) visita(p, horaNoDia(diaDe(H - r.int(10, 60) * DIA_MS), 9, 17), { resultado: r.pick(['aberto_sem_decisor', 'recusou']), tipo: 'reconquista', motivo: 'tem_fornecedor' });
    }

    pontos.push(p);
  }

  // ---------- V2.3 · B: a mensagem de recompra de 3 dias atrás não gerou pedido em duas ativações perto dos 45 dias ----------
  // (as de 3 pt primeiro, para a exceção aparecer na rota de exemplo)
  [...ativPerto].sort((a, b) => pontosValor(b) - pontosValor(a)).slice(0, 2).forEach((p) => {
    contatos.push({ id: id('ct-'), ponto_id: p.id, ts: iso(H - 3 * DIA_MS - r.int(60, 180) * 60000), canal: 'whatsapp', modelo_mensagem: 'recompra', gerado_pela_plataforma: true, vendedor_id: vendedorId });
  });

  // ---------- visitas de aquisição a leads: dão etapa 1/2/3 e os retornos com hora ----------
  // V2.3: o "Você" encontra o decisor em pouco mais da metade das visitas e volta na janela em metade das revisitas.
  const leads = pontos.filter((p) => !p.cadastro_em);
  const amanha = inicioHoje + DIA_MS;
  const INICIO = { '6-9': 6, '9-1130': 9, '1130-14': 11.5, '14-17': 14, '17-20': 17, noite: 20 };
  // hora fora da janela do decisor e a mais de 1 h do início dela (é o retorno que "não pega" o decisor)
  const foraDaJanela = (diaMs, faixa) => diaMs + Math.round(((INICIO[faixa] ?? 14) >= 13 ? r.int(9 * 60, 11 * 60) : r.int(15 * 60, 17 * 60)));
  const GRUPOS = [
    ['retorno', 12], // decisor ausente com janela → "Retornar" (metade hoje, metade amanhã)
    ['revisita', 20], // ausente; o retorno foi na janela (encontra o decisor) ou fora dela (não encontra)
    ['recusou', 12],
    ['ausente', 33], // decisor ausente, sem retorno marcado
    ['decisor', 14], // falou com o decisor e não cadastrou, com o motivo
    ['fechado', 8], // planejado, mas o ponto estava fechado
    ['planejado', 15], // entrou numa lista do dia e não foi visitado
  ];
  const grupoDe = [];
  for (const [g, n] of GRUPOS) for (let j = 0; j < n; j++) grupoDe.push(g);
  let k = 0;
  let nRevisita = 0;
  for (const p of leads) {
    const g = grupoDe[k];
    if (!g) break;
    const dias = r.int(1, 20);
    const ms = horaNoDia(diaDe(H - dias * DIA_MS), 9, 17);
    if (g === 'retorno') {
      const faixas = p.decisor?.janela?.faixas?.length ? p.decisor.janela.faixas : [r.pick(['9-1130', '14-17'])];
      if (!p.decisor) p.decisor = { papel: 'dono', janela: { dias: [], faixas }, atualizado_em: iso(ms) };
      const v = visita(p, ms, { resultado: 'aberto_sem_decisor', faixas, dias: [] });
      const ref = k < 6 ? inicioHoje + 8 * 3600000 : amanha;
      const quando = proximaOcorrencia(new Date(ref), faixas, []);
      v.proxima_acao = { tipo: 'retorno', data_hora: iso(quando.getTime()), confirmada: true };
      Object.assign(p, { status_dia: 'retornar', retorno_sugerido: iso(quando.getTime()), retorno_motivo: 'janela_decisor' });
    } else if (g === 'revisita') {
      const faixas = [p.decisor?.janela?.faixas?.[0] || '14-17'];
      p.decisor = { papel: p.decisor?.papel || 'dono', janela: { dias: [], faixas }, atualizado_em: iso(ms) };
      const ant = horaNoDia(diaDe(ms - r.int(2, 6) * DIA_MS), 9, 12);
      visita(p, ant, { resultado: 'aberto_sem_decisor', faixas, dias: [] });
      const previsto = proximaOcorrencia(new Date(ant + 3600000), faixas, []);
      const naJanela = nRevisita++ % 2 === 0; // metade na janela
      const ms2 = naJanela ? previsto.getTime() + r.int(0, 50) * 60000 : foraDaJanela(diaDe(previsto.getTime()), faixas[0]);
      const v = visita(p, ms2, naJanela
        ? { resultado: 'falou_com_decisor', motivo: r.pick(['vai_pensar', 'quer_prazo', 'tem_fornecedor', 'desconfia_app']) }
        : { resultado: 'aberto_sem_decisor', faixas, dias: [] });
      v.retorno_previsto = { quando: previsto.toISOString(), motivo: 'janela_decisor' };
      p.status_dia = 'visitado';
    } else if (g === 'recusou') {
      visita(p, horaNoDia(diaDe(H - r.int(2, 15) * DIA_MS), 9, 17), { resultado: 'recusou', motivo: r.pick(['tem_fornecedor', 'preco', 'nao_icp']) });
      p.status_dia = 'visitado';
    } else if (g === 'ausente') {
      visita(p, ms, { resultado: 'aberto_sem_decisor', faixas: p.decisor?.janela?.faixas || [], dias: [] });
      p.status_dia = 'visitado';
    } else if (g === 'decisor') {
      visita(p, ms, { resultado: 'falou_com_decisor', motivo: r.pick(['tem_fornecedor', 'preco', 'vai_pensar', 'quer_prazo', 'desconfia_app', 'sem_tempo']) });
      p.status_dia = 'visitado';
    } else if (g === 'fechado') {
      p.planejado_em = iso(diaDe(ms) + 7 * 3600000);
      visita(p, ms, { resultado: 'fechado' });
      p.status_dia = 'visitado';
    } else {
      p.planejado_em = iso(diaDe(H - r.int(1, 10) * DIA_MS) + 7 * 3600000);
    }
    k++;
  }

  // ---------- desconhecidos (camada do mapa e fila Descobrir) ----------
  const grupos = [['receita', 12], ['mapa_aberto', 10], ['baixa_confianca', 8]];
  for (const [grupo, n] of grupos) {
    for (let j = 0; j < n; j++) {
      const bairro = r.pick(Object.keys(BAIRROS));
      const caixa = BAIRROS[bairro];
      const tipo = r.peso(TIPOS_PESO);
      const nome = novoNome(tipo, bairro);
      desconhecidos.push({
        id: id('dc-'), grupo, nome, tipo, bairro,
        cnpj: grupo === 'mapa_aberto' ? null : cnpjFicticio(r),
        mei: grupo === 'mapa_aberto' ? null : r.chance(0.4),
        endereco: `Rua Projetada ${r.int(1, 60)}, ${r.int(10, 990)} · ${bairro} (fictício)`,
        lat: +(caixa.lat[0] + r() * (caixa.lat[1] - caixa.lat[0])).toFixed(6),
        lng: +(caixa.lng[0] + r() * (caixa.lng[1] - caixa.lng[0])).toFixed(6),
        confianca: grupo === 'baixa_confianca' ? +(0.4 + r() * 0.2).toFixed(2) : null,
        fonte: grupo === 'receita' ? 'Receita (fictício)' : grupo === 'mapa_aberto' ? 'Overture Maps (fictício)' : 'Receita + Overture (fictício)',
        status: 'novo', ficticio: true,
      });
    }
  }

  // ---------- V2.2 · o motivo de não avanço muda a tela de amanhã ----------
  // Leads que falaram com o decisor e não cadastraram, com o motivo marcado. A próxima ação vem de
  // CONFIG.motivos, como no app: metade volta hoje e metade amanhã, com "Da última vez" no card.
  // Fica no fim para não mexer no resto do seed.
  const semVisita = pontos.filter((p) => !p.cadastro_em && !p.planejado_em && !visitas.some((v) => v.ponto_id === p.id));
  const CASOS_MOTIVO = [['vai_pensar', 2, 0], ['preco', 3, 0], ['sem_tempo', 1, 0], ['desconfia_app', 3, 1], ['quer_prazo', 3, 1], ['tem_fornecedor', 7, 1]];
  CASOS_MOTIVO.forEach(([motivo, dias, depois], i) => {
    const p = semVisita[i];
    if (!p) return;
    const faixas = p.decisor?.janela?.faixas?.length ? p.decisor.janela.faixas : ['14-17'];
    p.decisor = { papel: p.decisor?.papel || 'dono', janela: { dias: [], faixas }, atualizado_em: null };
    // "sem tempo" foi ontem no fim da tarde, depois da janela; os outros, de manhã, `dias` antes do retorno
    const ms = motivo === 'sem_tempo' ? inicioHoje - DIA_MS + (17 * 60 + 30) * 60000 : inicioHoje - (dias - depois) * DIA_MS + 10 * 3600000;
    const v = visita(p, ms, { resultado: 'falou_com_decisor', faixas, dias: [], motivo });
    p.decisor.atualizado_em = v.checkout.em;
    const s = sugerirProximaAcao(v, p, { agora: new Date(v.checkout.em) });
    v.proxima_acao = { ...s, sugerida: true, confirmada_em: v.checkout.em };
    if (s.data_hora) Object.assign(p, { status_dia: 'retornar', retorno_sugerido: s.data_hora, retorno_motivo: 'proxima_acao' });
  });

  return { pontos, pedidos, visitas, contatos, desconhecidos, vendedores: [] };
}

/** Carrega o seed no store (marca a configuração e roda o motor em todos os pontos). */
export function carregarSeed(store, opts = {}) {
  const dados = gerarSeed({ hoje: store.agora(), vendedorId: store.estado.config.vendedor_id, ...opts });
  store.carregarLote(dados);
  store.setConfig({ seed: { versao: SEED_VERSAO, gerado_em: store.agora().toISOString() } });
  return dados.pontos.length;
}

export const horaTexto = (ms) => { const d = new Date(ms); return `${z(d.getHours())}:${z(d.getMinutes())}`; };
