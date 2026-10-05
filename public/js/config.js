// Tudo o que é regra ajustável mora aqui. Nada de modelo treinado: são regras transparentes,
// e cada uma tem um texto de motivo que aparece para o vendedor (princípio 7).
// Itens marcados PREMISSA precisam ser validados com o gestor (ver README).

export const CONFIG = {
  // ---------- Ciclo de vida (seção 5) ----------
  ciclo: {
    dias_ativacao: 45, // PREMISSA: conta desde a 1ª compra do ciclo
    dias_churn: 120, // mais de 120 dias sem comprar
    compras_para_recorrente: 3, // a 3ª compra (ou posterior) do ciclo precisa ser autônoma
  },

  // ---------- Pontuação de aquisição ----------
  pontos: { mei: 0.5, nao_mei: 1, alto_potencial: 3, mei_desconhecido: 1 },
  // PREMISSA: critério de alto potencial. Ponto de partida: não MEI e tipo de alto consumo de insumos.
  alto_potencial: {
    tipos_alto_consumo: ['restaurante', 'hamburgueria', 'pizzaria', 'lanchonete'],
    exige_nao_mei: true,
  },
  // PREMISSA: "conquistado" (conta para a meta) = virou recorrente.
  conquista_em: 'recorrente',

  // ---------- Motor de sugestão (seção 6.2) ----------
  // chance_hoje = base do estado × multiplicadores. pontos_esperados = pontos_valor × chance_hoje.
  chance: {
    base: {
      lead: 0.15, cadastrado_sem_compra: 0.3, ativacao: 0.4, ativacao_vencida: 0.2, churn: 0.15, recorrente: 0.05,
    },
    sobe: {
      janela_decisor: 1.6, // a janela do decisor cruza a chegada prevista
      retorno_hoje: 2.2, // retorno combinado para hoje
      recompra_vencendo: 1.7, // em ativação, perto da reposição ou dos 45 dias
      churn_historico_alto: 1.5, // churn com ticket/volume acima da mediana
    },
    cai: {
      pico: 0.5, // horário de pico do tipo
      recusou_recente: 0.3, // recusou há menos de `dias_recusa`
      visitado_sem_avanco: 0.4, // visitado há menos de `dias_sem_avanco` sem mudar de etapa
    },
    dias_recusa: 21,
    dias_sem_avanco: 7,
    dias_recompra_alerta: 10, // faltam até N dias para os 45 → "recompra vencendo"
  },

  // Picos por tipo: o dono está ocupado; visita rende menos. Faixas em "HH:MM".
  pico_por_tipo: {
    restaurante: [['11:30', '14:00']],
    lanchonete: [['11:30', '13:30'], ['17:30', '19:30']],
    padaria: [['06:00', '08:30'], ['17:00', '19:00']],
    pizzaria: [['19:00', '22:00']],
    hamburgueria: [['19:00', '22:00']],
    cafeteria: [['07:00', '09:00']],
    bar: [['18:00', '22:00']],
    outro: [],
  },

  // Funcionamento padrão quando o ponto não tem horário registrado (nunca bloqueia o fluxo).
  funcionamento_padrao: {
    restaurante: [['10:00', '15:30'], ['18:00', '23:00']],
    lanchonete: [['07:00', '22:00']],
    padaria: [['06:00', '20:00']],
    pizzaria: [['15:00', '23:30']], // preparo começa antes de abrir ao público
    hamburgueria: [['15:00', '23:30']],
    cafeteria: [['07:00', '19:00']],
    bar: [['15:00', '23:59']],
    outro: [['08:00', '18:00']],
  },

  // ---------- Roteirizador (seção 6.3) ----------
  rota: {
    tortuosidade: 1.4, // distância real ≈ haversine × fator
    velocidade_kmh: { moto: 22, carro: 18, a_pe: 4.5 },
    modo_padrao: 'moto',
    min_paradas: 8,
    max_paradas: 12,
    max_candidatos: 24, // candidatos levados ao roteirizador (o dia tem no máximo max_paradas)
    espera_max_min: 40, // espera aceitável até a janela abrir
    folga_retorno_min: 30, // retorno com hora: chegar até 30 min depois do combinado
  },
  // Duração estimada da visita (min) por tipo de visita. Substituída pela média medida (RF11) quando houver ≥ 3 visitas.
  duracao_visita_min: { aquisicao: 20, acompanhamento: 10, reconquista: 15 },
  min_amostras_duracao: 3,

  // ---------- Campo ----------
  limiar_corrigir_pino_m: 150,
  limiar_dedup_m: 50,
  limiar_dedup_nome: 0.5, // similaridade de nome (0–1)
  max_audio_s: 60,

  // ---------- Painel ----------
  meta_pontos_semana_padrao: 6,
};

/** Minutos desde 00h para "HH:MM". */
export const min = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};
