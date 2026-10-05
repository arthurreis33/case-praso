// Catálogo de opções dos chips. Valor (chave) vai para o export; rótulo vai para a tela.
// Mudar um rótulo é seguro. Mudar uma chave quebra a comparação entre exports: evite.

export const TIPOS = [
  ['restaurante', 'Restaurante'], ['padaria', 'Padaria'], ['lanchonete', 'Lanchonete'],
  ['pizzaria', 'Pizzaria'], ['hamburgueria', 'Hamburgueria'], ['cafeteria', 'Cafeteria'],
  ['bar', 'Bar'], ['outro', 'Outro'],
];

export const ESTADOS = [
  ['lead', 'Lead'], ['oportunidade', 'Oportunidade'], ['cliente', 'Cliente'], ['churn', 'Churn'],
];

export const STATUS_DIA = [
  ['a_visitar', 'A visitar'], ['retornar', 'Retornar'], ['visitado', 'Visitado'],
];

// RF06 · núcleo de 3 toques
export const RESULTADOS = [
  ['fechado', 'Fechado'], ['aberto_sem_decisor', 'Aberto sem decisor'],
  ['falou_com_decisor', 'Falou com decisor'], ['recusou', 'Recusou'],
];
export const QUEM_DECIDE = [
  ['dono', 'Dono'], ['socio', 'Sócio'], ['gerente', 'Gerente'], ['cozinheiro', 'Cozinheiro'], ['outro', 'Outro'],
];
// início em minutos desde 00h; usado pelo laço de retorno (RF10)
export const FAIXAS = [
  ['6-9', '6h–9h', 6 * 60], ['9-1130', '9h–11h30', 9 * 60], ['1130-14', '11h30–14h', 11 * 60 + 30],
  ['14-17', '14h–17h', 14 * 60], ['17-20', '17h–20h', 17 * 60], ['noite', 'Noite', 20 * 60],
];
// valor = getDay() do JS (0 = domingo); exibido de seg a dom
export const DIAS = [
  ['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom'],
];
export const VERSOES = [
  ['gatekeeper', 'Gatekeeper'], ['2min', '2 minutos'], ['10min', '10 minutos'],
];

// RF07 · bloco de pesquisa (ordem do roteiro)
export const OBSERVACOES = [
  ['sacola_atacarejo', 'Sacola de atacarejo'], ['caixas_marcas', 'Caixas e marcas visíveis'],
  ['entrega_acontecendo', 'Entrega acontecendo'], ['cardapio_fritura', 'Cardápio de fritura'],
];
export const QUEM_PAGA = [['decisor', 'O próprio decisor'], ['outra_pessoa', 'Outra pessoa']];
export const QUEM_RECEBE = [['decisor', 'O próprio decisor'], ['funcionario', 'Funcionário'], ['outro', 'Outro']];
export const CANAIS = [
  ['telefone', 'Telefone'], ['whatsapp', 'WhatsApp'], ['representante', 'Representante'],
  ['atacarejo', 'Atacarejo'], ['app_site', 'App ou site'], ['outro', 'Outro'],
];
export const SIM_NAO_NS = [['sim', 'Sim'], ['nao', 'Não'], ['nao_sabe', 'Não sabe']];
export const SIM_NAO = [['sim', 'Sim'], ['nao', 'Não']];
export const N_FORNECEDORES = [['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4 ou mais']];
export const ULTIMA_TROCA = [
  ['ultimo_mes', 'Último mês'], ['ultimos_6m', 'Últimos 6 meses'],
  ['mais_6m', 'Mais de 6 meses'], ['nunca_nao_lembra', 'Nunca ou não lembra'],
];
export const APPS = [['bees', 'BEES'], ['cayena', 'Cayena'], ['praso', 'Praso'], ['nenhum', 'Nenhum']];
export const FORMAS_PAGAMENTO = [
  ['dinheiro_pix', 'Dinheiro ou PIX'], ['boleto_vista', 'Boleto à vista'], ['boleto_prazo', 'Boleto a prazo'],
  ['cartao', 'Cartão'], ['fiado', 'Fiado ou caderneta'],
];
export const PRAZOS = [
  ['vista', 'À vista'], ['7', '7 dias'], ['14', '14 dias'], ['28-30', '28 a 30 dias'], ['30+', 'Mais de 30'],
];

// RF11 · como o texto foi registrado
export const MODOS_REGISTRO = [['voz', 'Voz'], ['digitacao', 'Digitação'], ['misto', 'Os dois']];

export function rotulo(lista, valor) {
  const item = lista.find(([v]) => v === valor);
  return item ? item[1] : (valor ?? '');
}
