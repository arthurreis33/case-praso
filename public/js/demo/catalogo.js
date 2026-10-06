// Catálogo FICTÍCIO de produtos (SKUs, nomes e preços inventados). Serve ao seed, ao simulador,
// à cesta de entrada e às mensagens de recompra. Em produção viria do sistema da Praso.
export const CATEGORIAS = [
  // V2.1: rótulos com os nomes dos departamentos de praso.com.br onde há correspondência direta (as chaves não mudam)
  ['oleos_gorduras', 'Óleos e gorduras'], ['congelados', 'Congelados'], ['carnes', 'Carnes, Aves e Pescados'],
  ['laticinios', 'Frios e Queijos'], ['farinhas', 'Farinhas e panificação'], ['molhos', 'Molhos, Temperos e Conservas'],
  ['bebidas', 'Bebidas'], ['descartaveis', 'Descartáveis e Embalagens'], ['mercearia', 'Mercearia'], ['cafe', 'Café e açúcar'],
];

// [sku, nome, categoria, preço unitário em R$]
export const PRODUTOS = [
  ['OG01', 'Óleo de soja 900 ml (cx 20)', 'oleos_gorduras', 139.9],
  ['OG02', 'Gordura vegetal para fritura 15 kg', 'oleos_gorduras', 189.0],
  ['OG03', 'Margarina 500 g (cx 12)', 'oleos_gorduras', 84.5],
  ['CG01', 'Batata pré-frita congelada 2,5 kg (cx 4)', 'congelados', 112.0],
  ['CG02', 'Batata palito corte fino 2 kg (cx 6)', 'congelados', 138.0],
  ['CG03', 'Polpa de fruta 1 kg (cx 10)', 'congelados', 76.0],
  ['CA01', 'Hambúrguer bovino 120 g (cx 36)', 'carnes', 154.0],
  ['CA02', 'Peito de frango congelado 1 kg (cx 10)', 'carnes', 129.0],
  ['CA03', 'Calabresa fatiada 1 kg (cx 6)', 'carnes', 118.0],
  ['CA04', 'Presunto fatiado 1 kg', 'carnes', 32.9],
  ['LA01', 'Queijo muçarela fatiado 1 kg', 'laticinios', 42.9],
  ['LA02', 'Requeijão culinário 1,8 kg', 'laticinios', 36.5],
  ['LA03', 'Leite UHT 1 L (cx 12)', 'laticinios', 58.0],
  ['LA04', 'Creme de leite 1 kg', 'laticinios', 24.9],
  ['FA01', 'Farinha de trigo especial 25 kg', 'farinhas', 98.0],
  ['FA02', 'Fermento biológico 500 g', 'farinhas', 14.5],
  ['FA03', 'Mistura para pão francês 10 kg', 'farinhas', 64.0],
  ['MO01', 'Ketchup sachê 7 g (cx 192)', 'molhos', 29.9],
  ['MO02', 'Maionese 3 kg', 'molhos', 33.9],
  ['MO03', 'Molho de tomate 2 kg', 'molhos', 18.9],
  ['MO04', 'Sal refinado 1 kg (fardo 10)', 'molhos', 19.9],
  ['BE01', 'Refrigerante lata 350 ml (fardo 12)', 'bebidas', 39.9],
  ['BE02', 'Água mineral 500 ml (fardo 12)', 'bebidas', 14.9],
  ['BE03', 'Cerveja lata 350 ml (fardo 12)', 'bebidas', 44.9],
  ['DE01', 'Embalagem para hambúrguer (pct 100)', 'descartaveis', 27.0],
  ['DE02', 'Caixa de pizza 35 cm (pct 50)', 'descartaveis', 49.0],
  ['DE03', 'Copo descartável 300 ml (cx 1000)', 'descartaveis', 62.0],
  ['DE04', 'Guardanapo (fardo)', 'descartaveis', 21.0],
  ['ME01', 'Arroz tipo 1 5 kg (fardo 6)', 'mercearia', 149.0],
  ['ME02', 'Feijão carioca 1 kg (fardo 10)', 'mercearia', 79.0],
  ['ME03', 'Açúcar refinado 1 kg (fardo 10)', 'cafe', 46.0],
  ['CF01', 'Café torrado e moído 500 g (cx 10)', 'cafe', 189.0],
];

// Peso de cada categoria por tipo de estabelecimento (o que ele mais compra).
export const PERFIL_TIPO = {
  restaurante: { mercearia: 5, carnes: 5, oleos_gorduras: 3, molhos: 3, laticinios: 2, bebidas: 3, descartaveis: 1 },
  lanchonete: { oleos_gorduras: 5, congelados: 5, carnes: 4, molhos: 3, laticinios: 2, bebidas: 3, descartaveis: 2 },
  padaria: { farinhas: 6, oleos_gorduras: 4, laticinios: 4, carnes: 2, cafe: 3, bebidas: 2 },
  pizzaria: { laticinios: 6, farinhas: 4, molhos: 4, carnes: 4, descartaveis: 3, bebidas: 3 },
  hamburgueria: { carnes: 6, congelados: 5, molhos: 4, oleos_gorduras: 3, descartaveis: 3, bebidas: 3, laticinios: 2 },
  cafeteria: { cafe: 6, laticinios: 5, farinhas: 2, descartaveis: 3, congelados: 2 },
  bar: { bebidas: 7, congelados: 3, carnes: 3, oleos_gorduras: 2, molhos: 2, descartaveis: 1 },
  outro: { mercearia: 3, bebidas: 3, descartaveis: 2, cafe: 2 },
};

// Cesta de entrada: 3 a 5 itens de UMA categoria, a que mais dói para o tipo (seção 6.8).
// PALPITE (V2.2): cenário simulado. As visitas de campo foram poucas para calibrar este valor; ver README → próximos passos.
export const CESTA_ENTRADA = {
  lanchonete: { categoria: 'oleos_gorduras', titulo: 'Fritura', skus: ['OG02', 'OG01', 'CG01', 'CG02'], porque: 'fritura é o insumo que mais gira e mais pesa no caixa' },
  hamburgueria: { categoria: 'carnes', titulo: 'Hambúrguer', skus: ['CA01', 'LA01', 'MO02', 'DE01'], porque: 'carne e queijo são a maior parte do custo do lanche' },
  pizzaria: { categoria: 'laticinios', titulo: 'Base da pizza', skus: ['LA01', 'LA02', 'MO03', 'CA03'], porque: 'muçarela é o item mais caro e mais recorrente' },
  padaria: { categoria: 'farinhas', titulo: 'Panificação', skus: ['FA01', 'FA02', 'FA03', 'OG03'], porque: 'trigo e fermento são compra semanal' },
  restaurante: { categoria: 'mercearia', titulo: 'Mercearia básica', skus: ['ME01', 'ME02', 'OG01', 'MO04'], porque: 'arroz, feijão e óleo saem todo dia' },
  cafeteria: { categoria: 'cafe', titulo: 'Café', skus: ['CF01', 'ME03', 'LA03'], porque: 'café e leite são a base do cardápio' },
  bar: { categoria: 'bebidas', titulo: 'Bebidas', skus: ['BE03', 'BE01', 'BE02'], porque: 'bebida gira todo fim de semana' },
  outro: { categoria: 'mercearia', titulo: 'Mercearia básica', skus: ['ME01', 'OG01', 'BE02'], porque: 'itens de giro rápido' },
};

export const PRODUTO = Object.fromEntries(PRODUTOS.map(([sku, nome, categoria, preco]) => [sku, { sku, nome, categoria, preco }]));
export const rotuloCategoria = (c) => CATEGORIAS.find(([k]) => k === c)?.[1] || c;
