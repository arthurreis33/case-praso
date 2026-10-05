// Dados FICTÍCIOS de exemplo. Nomes, endereços e coordenadas inventados (centro do Recife
// apenas como referência geográfica). Todos marcados ficticio=true e removíveis num toque.
// Dados reais de campo nunca entram no repositório.

const PONTOS = [
  { nome: 'Lanchonete Exemplo A', tipo: 'lanchonete', endereco: 'Rua Fictícia Um, 10 · Bairro Exemplo', lat: -8.06305, lng: -34.87112 },
  { nome: 'Padaria Exemplo B', tipo: 'padaria', endereco: 'Rua Fictícia Dois, 220 · Bairro Exemplo', cnpj: '99999999000199', lat: -8.06190, lng: -34.87390 },
  { nome: 'Restaurante Exemplo C', tipo: 'restaurante', endereco: 'Av. Fictícia Três, 45 · Bairro Exemplo' },
  { nome: 'Pizzaria Exemplo D', tipo: 'pizzaria', endereco: 'Rua Fictícia Quatro, 7 · Bairro Exemplo' },
  { nome: 'Hamburgueria Exemplo E', tipo: 'hamburgueria', endereco: 'Rua Fictícia Cinco, 88 · Bairro Exemplo', estado: 'oportunidade' },
  { nome: 'Bar Exemplo F', tipo: 'bar', endereco: 'Rua Fictícia Seis, 300 · Bairro Exemplo', estado: 'churn' },
];

export function carregarExemplo(store) {
  const criados = PONTOS.map((d) => store.novoPonto({ ...d, ficticio: true, coord_fonte: 'exemplo' }));
  // Uma visita de exemplo já registrada, para mostrar o laço de retorno funcionando:
  // decisor ausente, janela 6h–9h → o ponto aparece em "Retornar" no próximo 6h.
  const a = criados[0];
  const v = store.checkin(a.id);
  store.registrarGeo(v.id, { lat: a.lat, lng: a.lng, precisao_m: 12 });
  store.setCampo(v.id, 'versao_conversa', 'gatekeeper');
  store.setCampo(v.id, 'nucleo.resultado', 'aberto_sem_decisor');
  store.setCampo(v.id, 'nucleo.quem_decide', 'dono');
  store.setCampo(v.id, 'nucleo.faixas', ['6-9']);
  store.salvarNucleo(v.id);
  store.setCampo(v.id, 'surpresa', 'Exemplo fictício: atendente disse que o dono compra no atacarejo antes de abrir.');
  store.setCampo(v.id, 'registro_modo', 'digitacao');
  store.checkout(v.id);
  return criados.length;
}
