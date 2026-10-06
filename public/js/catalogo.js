// Catálogo de opções dos chips. Valor (chave) vai para o export; rótulo vai para a tela.
// Mudar um rótulo é seguro. Mudar uma chave quebra a comparação entre exports: evite.

export const TIPOS = [
  ['restaurante', 'Restaurante'], ['padaria', 'Padaria'], ['lanchonete', 'Lanchonete'],
  ['pizzaria', 'Pizzaria'], ['hamburgueria', 'Hamburgueria'], ['cafeteria', 'Cafeteria'],
  ['bar', 'Bar e petiscos'], ['outro', 'Outro'],
];

// V2 · estado do ponto (seção 5). Chave interna (vai para o export) → rótulo curto que o vendedor fala (V2.1).
// "Oportunidade", do case, vira o grupo de Cadastrado + Churn (ver ESTADO_DESCRICAO e a auditoria, frente D).
export const ESTADOS = [
  ['lead', 'Lead'], ['cadastrado_sem_compra', 'Cadastrado'], ['ativacao', 'Ativando'],
  ['recorrente', 'Recorrente'], ['ativacao_vencida', 'Vencido'], ['churn', 'Churn'],
];
// Uma frase por estado, com a definição do case por trás (ficha e legenda do mapa).
export const ESTADO_DESCRICAO = {
  lead: 'Nunca se cadastrou na Praso',
  cadastrado_sem_compra: 'Oportunidade · cadastrou e ainda não comprou',
  ativacao: 'Entre a 1ª e a 3ª compra, dentro de 45 dias',
  recorrente: 'Fez a 3ª compra sozinho pelo app',
  ativacao_vencida: 'Passou dos 45 dias sem a 3ª compra pelo app',
  churn: 'Oportunidade · mais de 120 dias sem comprar',
};
// V1 · usado só pela migração
export const ESTADOS_V1 = [['lead', 'Lead'], ['oportunidade', 'Oportunidade'], ['cliente', 'Cliente'], ['churn', 'Churn']];

// Etapas do funil (1 a 6). 0 = ainda fora do funil do ciclo atual.
export const ETAPAS = [
  [1, 'Visita planejada'], [2, 'Visitado'], [3, 'Decisor encontrado'],
  [4, 'Cadastro'], [5, '1ª compra'], [6, '3ª compra pelo app'],
];
export const ORIGENS = [['base_praso', 'Base Praso'], ['receita', 'Receita'], ['mapa_aberto', 'Mapa aberto'], ['campo', 'Campo']];
export const TIPOS_VISITA = [['aquisicao', 'Aquisição'], ['acompanhamento', 'Acompanhamento'], ['reconquista', 'Reconquista']];
export const CAUSAS = [
  ['registro_visita', 'registro de visita'], ['cadastro', 'cadastro detectado'], ['pedido', 'pedido detectado'],
  ['tempo', 'tempo'], ['correcao_manual', 'correção manual'], ['planejamento', 'entrou na lista do dia'], ['migracao', 'migração da V1'],
];

export const STATUS_DIA = [
  ['a_visitar', 'A visitar'], ['retornar', 'Retornar'], ['visitado', 'Visitado'],
];

// RF06 · núcleo de 3 toques
// "fechado" = o ESTABELECIMENTO estava fechado (não é negócio fechado). Chave mantida da V1.
export const RESULTADOS = [
  ['fechado', 'Ponto fechado'], ['aberto_sem_decisor', 'Aberto sem decisor'],
  ['falou_com_decisor', 'Falou com decisor'], ['recusou', 'Recusou'],
];
// PALPITE (V2.2): cenário simulado. As visitas de campo foram poucas para calibrar este valor; ver README → próximos passos.
export const QUEM_DECIDE = [
  ['dono', 'Dono'], ['socio', 'Sócio'], ['gerente', 'Gerente'], ['cozinheiro', 'Cozinheiro'], ['outro', 'Outro'],
];
// [chave, rótulo, início, fim] em minutos desde 00h; usado pelo laço de retorno (RF10) e pelo roteirizador
export const FAIXAS = [
  ['6-9', '6h–9h', 6 * 60, 9 * 60], ['9-1130', '9h–11h30', 9 * 60, 11 * 60 + 30],
  ['1130-14', '11h30–14h', 11 * 60 + 30, 14 * 60], ['14-17', '14h–17h', 14 * 60, 17 * 60],
  ['17-20', '17h–20h', 17 * 60, 20 * 60], ['noite', 'Noite', 20 * 60, 23 * 60],
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
// PALPITE (V2.2): cenário simulado. As visitas de campo foram poucas para calibrar este valor; ver README → próximos passos.
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

// RF11 · como o texto foi registrado (V2: nota_origem)
export const MODOS_REGISTRO = [['voz', 'Voz'], ['digitacao', 'Digitação'], ['misto', 'Os dois']];

// V2 · motivo de não avanço (só aparece quando o resultado não é avanço)
// PALPITE (V2.2): cenário simulado. As visitas de campo foram poucas para calibrar este valor; ver README → próximos passos.
export const MOTIVOS_NAO_AVANCO = [
  ['tem_fornecedor', 'Já tem fornecedor'], ['preco', 'Preço'], ['quer_prazo', 'Quer prazo'],
  ['desconfia_app', 'Desconfia de app'], ['sem_tempo', 'Sem tempo agora'], ['vai_pensar', 'Vai pensar'],
  ['nao_icp', 'Não é ICP'], ['outro', 'Outro'],
];
// V2 · próxima ação
export const PROXIMAS_ACOES = [
  ['retorno', 'Retornar'], ['acompanhar_1a_compra', 'Acompanhar 1ª compra'], ['mensagem_recompra', 'Mensagem de recompra'],
  ['lembrete_1a_compra', 'Lembrete de 1ª compra'], ['reconquista', 'Tentar reconquista'], ['nenhuma', 'Sem próxima ação'],
];
// V2 · bloco de pesquisa: o que o faria trocar de fornecedor
// PALPITE (V2.2): cenário simulado. As visitas de campo foram poucas para calibrar este valor; ver README → próximos passos.
export const GATILHOS_TROCA = [
  ['preco', 'Preço'], ['prazo_pagamento', 'Prazo de pagamento'], ['entrega_rapida', 'Entrega rápida'],
  ['sem_minimo', 'Sem pedido mínimo'], ['qualidade', 'Qualidade'], ['atendimento', 'Atendimento'], ['nada', 'Nada'],
];
export const QUEM_PAGA_PONTO = [['decisor', 'O decisor'], ['outro', 'Outra pessoa']];
export const DESCARTE = [['fechou', 'Fechou'], ['nao_icp', 'Não é ICP'], ['duplicado', 'Duplicado']];
export const MODOS_DESLOCAMENTO = [['moto', 'Moto'], ['carro', 'Carro'], ['a_pe', 'A pé']];

export function rotulo(lista, valor) {
  const item = lista.find(([v]) => v === valor);
  return item ? item[1] : (valor ?? '');
}
