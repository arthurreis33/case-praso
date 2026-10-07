# Changelog

## V2.3 · 06/10/2026

Ajustes de coerência entre o protótipo, a tese do README e o playbook. Nada fora destes cinco pontos mudou; o plano e o que ficou de fora estão em `docs/PLANO_V2_3.md`.

- **A · O motivo respeita a janela do decisor (correção):** "Preço", "Quer prazo" e "Vai pensar" sugeriam o retorno na abertura do ponto, mesmo com a janela do decisor conhecida, e o primeiro horário da rota de exemplo era um retorno marcado para quando o decisor não estava. Agora os três têm `janela: true` em `CONFIG.motivos` (os prazos de 3, 3 e 2 dias não mudaram) e dizem "na janela dele" no porquê. Sem janela conhecida, continuam na abertura. `tests/motivos.test.mjs` cobre os casos novos.
- **B · Ativação fora da rota por padrão:** o motor deixa de sugerir visita a cliente em ativação, que é acompanhado por mensagem no chip de recompras. A exceção é a mensagem que falhou: com um contato de WhatsApp de 2 dias ou mais (`chance.ativacao_visita.dias_sem_pedido_apos_contato`, PREMISSA) e nenhum pedido depois, o ponto volta à rota com o motivo "mensagem sem pedido há N dias: vale a visita". Retornos combinados e pontos postos à mão continuam. A espera de 60 min ou mais (`rota.intervalo_longo_min`, PREMISSA) vira uma linha de intervalo na rota, que abre o chip de recompras. O seed ganha duas ativações com a mensagem de 3 dias atrás sem pedido, e `tests/plano.test.mjs` cobre a regra, a exceção e o ponto posto à mão.
- **C · Os dados de exemplo contam a história da tese:** o seed foi recalibrado para o "Você" ser um vendedor mediano (3º do time, perto de 17% de conversão total) que mais perde em visitada → decisor (58%, 12 p.p. abaixo do quartil de cima) e volta na janela em metade das revisitas. Como o funil conta todo cadastrado como visitado e decisor, a carteira de exemplo passou a ter menos pontos cadastrados e mais leads visitados, com os mesmos 210 pontos fictícios nos três bairros, e os lembretes de 1ª compra vêm antes do 1º pedido. Na Equipe, os de cima voltaram a ser 2 nomes (`slice(0, n)`), e os textos usam a quantidade listada. `tests/seed.test.mjs` cobre as faixas do funil, a Semana, a Carteira, a Equipe e os retornos na janela.
- **D · Tela de visita sem a instrumentação da pesquisa:** "Pesquisa (opcional)" e "O que me surpreendeu aqui" saem da tela (`CONFIG.visita.pesquisa_de_campo: false`), e o modelo, a extração e o export continuam iguais, com as colunas vazias. O chip "A nota foi por" saiu, e a origem da nota é inferida no store, inclusive voz e depois texto, que agora grava `misto`. Antes do check-out há uma só ação principal, "Salvar e fazer check-out" (ou "Check-out", sem resultado), cujo aviso já mostra a volta, e a rolagem vai para a nota. `tests/store.test.mjs` cobre a origem da nota e o check-out que salva o núcleo.
- **E · README e versão:** título V2.3, o link de avaliação `https://case-praso.vercel.app/?demo=1`, a seção "O que a plataforma mostra, pede e devolve", o laço como passo 1 da demonstração, a decisão 11 e as duas premissas novas. `VERSAO` do service worker trocada.
- **Simulador:** o **+1 dia** leva ao começo da jornada do dia seguinte, para o passo 1 da demonstração funcionar em qualquer horário (o retorno marcado hoje aparece na rota de amanhã, na hora da janela). Os +7, +30 e +46 continuam mantendo a hora, e o selo do relógio conta dias de calendário.

## V2.2 · Fase B · 06/10/2026

Cenário simulado: as regras são implementadas de verdade, e os valores são palpites assumidos. As visitas de campo foram poucas para calibrar.

- **B1 · Regras de comportamento como palpite:** nenhum valor foi trocado. Picos e funcionamento por tipo (`config.js`), `QUEM_DECIDE`, `MOTIVOS_NAO_AVANCO`, `GATILHOS_TROCA` e `CANAIS` (`catalogo.js`) e a cesta de entrada (`demo/catalogo.js`) ganharam a marca `PALPITE (V2.2)`. A calibração foi para "próximos passos" no README.
- **B2 · O motivo de não avanço devolve algo:**
  - **Regras num lugar só:** `CONFIG.motivos` tem uma entrada por motivo, com a próxima ação, o argumento para a próxima visita e o porquê. São palpites do cenário simulado.
  - **Próxima ação:** com o motivo marcado, a sugestão vem de `CONFIG.motivos`. Por exemplo, "Preço" sugere retorno em 3 dias, "Já tem fornecedor" em 7 dias na janela, e "Não é ICP" fica sem próxima ação. Sem motivo, ou com "Outro", vale a regra de antes.
  - **Ficha e card do Hoje:** a linha "Da última vez: {motivo} · {argumento}". No card, ela é uma 4ª linha, que só aparece quando há motivo.
  - **Prioridade:** "Não é ICP" na última visita zera a chance e explica ("Hoje não: não é ICP"). Os outros motivos não mexem na chance.
  - **Equipe:** seção "Por que não avançou", com a fração das perdas por motivo e vendedor e o contraste entre os 2 de cima e os 2 de baixo nos motivos de execução ("sem tempo", "vai pensar" e "desconfia de app").
  - **Semana:** os 3 motivos mais frequentes dos últimos 7 dias, numa linha.
  - **Dados de exemplo:** a equipe ganha motivos determinísticos, com semente própria para os outros números não mudarem. O seed ganha 6 leads com motivo marcado e retorno hoje ou amanhã, como o app sugeriria.
  - **Testes:** `tests/motivos.test.mjs` cobre cada motivo, o caso sem motivo, a prioridade e os painéis.
- **B3 · Do cadastro ao primeiro pedido:**
  - **Na visita:** com o cadastro feito durante a visita, o destaque troca para "Cadastro feito · próximo passo: 1º pedido agora, com ele". Ele mostra a cesta de entrada do tipo e lembra que, sem pedido mínimo, um pedido pequeno vale (`destaqueAquisicao`, em `whatsapp.js`, reaproveita a `cesta()`).
  - **Próxima ação:** "Acompanhar 1ª compra" no dia seguinte, com o porquê "se não pediu na visita".
  - **Prioridade:** duas regras **PREMISSA** em `config.js`. `chance.sobe.cadastro_recente` multiplica a chance por 1,8 até 3 dias depois do cadastro e por 1,3 até 10 dias. `chance.cai.cadastro_antigo` multiplica por 0,6 depois de 30 dias sem compra. O motivo aparece no card: "cadastrou há 2 dias: a 1ª compra é agora" ou "cadastrado há 40 dias sem compra".
  - **Testes:** `tests/cadastro.test.mjs` cobre os limites da chance (0, 3, 4, 10, 11, 30 e 31 dias) e a troca do destaque quando o cadastro acontece na visita.
- **Fechamento da Fase B:**
  - **README:** três decisões novas, cada uma com ganho e custo ("o campo calibra regras, não dados", "o motivo vira a próxima ação" e "o cadastro não é o fim da visita"), e duas premissas novas na tabela.
  - **Ficha:** com "Não é ICP" na última visita, a próxima ação mostra "Sem próxima ação".
  - **Auditoria e service worker:** seção V2.2 da auditoria atualizada e `VERSAO` trocada.
  - **Verificação:** a 360 e 412 px, de dia e à noite.

## V2.2 · Fase A · 06/10/2026

- **Seed coerente com a H1:** o tempo de registro do "Você" no exemplo saía de `r.int(14, 70)`, com média perto de 42 s, contra a meta de menos de 20 s da própria H1. Agora 70% das visitas ficam entre 10 e 22 s e 30% entre 23 e 45 s (mediana perto de 18 s). Continua determinístico, e `tests/seed.test.mjs` cobre a faixa e a repetição.
- **"Oportunidades" na Carteira:** a Lista ganhou o chip **Oportunidades**, primeiro da linha de estados. Ele liga Cadastrado e Churn juntos e desliga os dois quando ambos já estão ligados. O link `#/carteira?filtro=oportunidade` abre a Lista com esse filtro. Os rótulos e as chaves dos estados não mudaram.
- **README:** seção **A aposta** logo abaixo do título (o laço entre registro, janela do decisor e rota, que move a etapa de visita efetiva para decisor), com o marcador do que o campo mostrar. Seção **Como provar que funciona** antes das premissas: piloto de 45 dias contra o Salesforce, linha de base, métricas, critério de sucesso, sinais de adoção e o que sai do Salesforce primeiro, com os números `[a definir]`. Em "Como rodar", o link de avaliação `praso-campo-v1.vercel.app/?demo=1`.
- **Fechamento da Fase A:** seção "V2.2" em `docs/AUDITORIA_V2.md`, `VERSAO` do service worker trocada e verificação a 360 e 412 px (sem rolagem horizontal, sem erro no console e com alvos de 48 px ou mais).

## V2.1.1 · 06/10/2026

- **Correção:** o Mapa quebrava com "L.divIcon is not a function" sempre que a carteira tinha um ponto sem localização. A função que desenha o pino tinha o mesmo nome do ícone importado e o escondia. Ela foi renomeada para `iconePino`, e um teste no navegador (`qa/mapa_sem_pino.mjs`) passou a cobrir o caso.
- O aviso "N pontos sem localização" leva à Lista com o novo filtro **Sem localização**.
- **Linhas de chips no computador:** os filtros do Mapa e da Carteira e as pendências do Hoje rolavam para o lado só com o dedo. Com mouse, agora aparece uma barra de rolagem azul e fina. Também dá para rolar com a roda do mouse ou arrastar com o botão pressionado, e arrastar não liga um filtro sem querer. No celular, nada muda. O caso fica coberto por `qa/rolagem_lado.mjs`.

## V2.1 · 06/10/2026

Revisão de produto, arquitetura e design para o teste com vendedores na rua. Nenhuma função foi apagada: o que saiu da tela mudou de lugar. A auditoria está em `docs/AUDITORIA_V2.md`, e os prints de antes e depois em `docs/prints/v2.1/`.

### Fatia 1 · Interação
- Botão voltar no topo de toda tela por cima (ficha, visita, novo ponto, Descobrir, simulador). Quem entra direto num link volta para o Hoje, sem sair do app.
- "Não couberam" vira card e abre a ficha. Os nomes dos pontos conquistados na semana abrem a ficha, e o nome do ponto na visita também.
- Os links "ver na Carteira" abrem a Lista já filtrada (`#/carteira?filtro=prazo|retornar|verificar|sem_visita|estado:…`). A Lista ganhou os filtros "Retorno marcado" e "Sem CNPJ".
- O quadro "recompras em risco" vira link. A linha de visita na linha do tempo ganha um alvo de 48 px.
- A rolagem da aba volta ao mesmo lugar depois de abrir uma ficha.
- Sair do mapa durante a animação não gera mais erro no console.

### Fatia 2 · Texto, modo demonstração e Perfil
- **Modo demonstração** (`?demo=1`, 5 toques seguidos na logo ou Perfil). Só nele aparecem o simulador, o relógio simulado, o selo "exemplo" e os atalhos "simular". O simulador continua inteiro e abre pelo Perfil. Sem o modo, `#/sim` leva ao Perfil.
- **Perfil** (ícone no topo), com:
  - **Minha rota:** deslocamento, base, jornada e tempo por visita, que saíram do fim do Hoje.
  - **Backup:** baixar CSV e JSON, compartilhar e restaurar. Saiu do botão "Exportar" do topo. Um ponto amarelo no ícone avisa quando há visita sem backup, e o aviso do Hoje leva até lá.
  - **Visão do gestor.**
  - **Dados de exemplo:** carregar, gerar de novo e remover.
  - **Modo demonstração.**
- **Primeira abertura:** sem o modo demonstração, a carteira começa vazia, com boas-vindas e "Ver com dados de exemplo". No modo demonstração, carrega os 210 pontos de exemplo como antes.
- **Estados vazios** de Hoje, Carteira e Semana. O painel não diz mais que você está "no nível do quartil de cima" com zero pontos.
- **Texto de avaliador** sai da tela e entra microtexto de vendedor (lista completa na auditoria, frente D). O motivo de cada decisão continua no README.
- **Ícones** Lucide (ISC) num sprite local e **fonte** Inter (OFL) local, ambos no cache do service worker.
- Testes novos do modo demonstração (64 no total).

### Fatia 3 · Arquitetura de informação
- **Hoje enxuto.** O título e um resumo de 2 linhas vêm primeiro, e a rota aparece logo abaixo. Os três blocos grandes do topo viraram uma faixa de chips com o que está **fora** da rota: retornos, recompras vencendo e pontos para conhecer. Cada chip abre a lista com as mesmas ações de antes (pôr na rota e WhatsApp). O retorno que já está na rota aparece uma vez só, no card ("Volta amanhã 09:00").
- **Card com no máximo 3 linhas:**
  - nome e hora;
  - estado, pontos e a situação ("2/3 compras · faltam 9 dias para a 3ª compra");
  - o porquê, sem repetir a linha 2.
  Os pontos prováveis saíram do card e foram para a ficha. "Tirar" e "Rota" ganharam ícone.
- **Ficha:** a próxima ação aparece em destaque, com "Por que ir hoje" e os pontos prováveis. O estado vem com uma frase que explica o que ele quer dizer. A etapa aparece pelo nome, sem número.
- **Gestor como papel separado.** A tela "Equipe" saiu da aba e abre pelo Perfil, com o voltar. A aba "Painel" virou **Semana**, só do vendedor.
- **Termos do vendedor.** As chaves e o export não mudam.
  - Estados: Lead · Cadastrado · Ativando · Recorrente · Vencido · Churn. "Oportunidade" aparece na descrição de Cadastrado e de Churn.
  - Prazo: "faltam N dias para a 3ª compra".
  - Pedido: "pelo app" ou "com você", no lugar de autônomo e assistido.
  - Comparação: "os melhores do time", no lugar de quartil de cima.
  - Tempo: "registro", no lugar de núcleo.
- **Mapa:** os pinos e os filtros usam ícone no lugar da letra. A legenda fica recolhida e explica cada estado. Uma linha avisa quantos pontos estão sem localização e leva à Carteira.

### Fatia 4 · Design alinhado à Praso
- **Logo da Praso** no topo, recortada do `logo_praso.png` do Project, sem redesenho. O ícone do app usa o símbolo do mesmo arquivo. O topo fica no azul da marca.
- **Tokens:**
  - cores: azul `#2053CE` (escuro `#123DA1`, claros `#DCE6FD` e `#EFF4FF`), amarelo `#FAD705` só no Check-in, verde `#15803D` no WhatsApp, neutros da escala cinza do site e estados com contraste ≥ 5:1;
  - forma: raio de 8 px e sombra mínima.
  Os valores e contrastes estão na auditoria, frente F.
- **Inter Variable** servida localmente (`public/fonts/`, OFL 1.1), como no site.
- **Gramática visual:** o que é clicável tem borda ou fundo azul, e os cards têm a faixa de ações à direita. Selos, quadros e caixas são informação e não têm cara de botão.
- **Ícones Lucide** nas abas, nos selos de estado, nas ações do card e nos botões principais.
- O service worker guarda fonte, logo e ícones: o app abre igual sem rede.

### Fatia 5 · Aderência à Praso
- **Checklist de cadastro igual ao fluxo real do app** (prints de 06/10): e-mail → nome e WhatsApp → estabelecimento e CNPJ → endereço com o pino no mapa → "Como você conheceu a Praso?" → categoria. Em destaque: marcar **"Vendedor da Praso"** e conferir o pino da entrega. Sem CNPJ, o checklist explica o cadastro com CPF e o que o cliente perde.
- **Aviso de crédito com a promessa do próprio cadastro:** "com CNPJ, 7 dias para pagar, mediante análise de crédito: não prometa".
- O tipo "Bar" passa a se chamar "Bar e petiscos", como a categoria do app.
- **Mensagens de WhatsApp** com a condição do site: "Pedido até as 19h chega no dia seguinte, de segunda a sábado".
- **Cesta de entrada:** "entre por uma necessidade só". A frase anterior, "uma categoria só", não era verdade para a cesta de fritura, que mistura óleo e batata.
- **Catálogo de exemplo** com os nomes dos departamentos do site onde há correspondência direta.
- Testes novos das mensagens e da cesta (67 no total).

## V2 · 05/10/2026

Construída em fatias, cada uma com testes passando e verificada no Chromium a 360 px (as telas finais também a 412 px). O plano está em `docs/PLANO_V2.md`.

### Fatia 1 · Modelo, estados e simulador
- Schema 2: ponto com estado e etapa; pedidos, contatos, `EventoEstado` (só acrescenta) e vendedores.
- Motor de estados puro (`estados.js`): lead, oportunidade, em ativação, recorrente, ativação vencida e churn, com causa e data de cada transição.
- Persistência em IndexedDB com diário síncrono no localStorage. Fallback em memória.
- Migração da V1: lê o localStorage da V1 no mesmo domínio ou importa o JSON.
- Seed fictício de 210 pontos em Boa Viagem, Pina e Imbiribeira, com pedidos coerentes por tipo, churns com histórico rico, ativações perto dos 45 dias, decisores com e sem janela, pontos sem CNPJ e desconhecidos.
- Simulador: cadastro, pedido autônomo ou assistido, pagamento e relógio (+N dias).
- Casca com 4 abas (Hoje, Mapa, Carteira, Painel).
- Testes: 45 dias, 120 dias, retorno de churn, compra autônoma × assistida e idempotência dos eventos.

### Fatia 2 · Carteira e ficha
- Funil vertical com contagem, taxa de passagem e destaque da etapa onde mais se perde. Tocar numa etapa expande os cards, que mostram o selo "avançou" por alguns segundos.
- Lista com busca por nome ou CNPJ, filtros (estado, tipo, pontos, sem visita há mais de 14 dias, prazo vencendo) e ordenação (pontos esperados, distância, prazo).
- Adicionar ponto: BrasilAPI pelo CNPJ (com fallback manual), sem CNPJ ("verificar depois") e deduplicação a 50 m com nome parecido ("é este?").
- Ficha por estado:
  - lead: checklist do cadastro e o aviso "prazo depende de análise de crédito";
  - ativação: 1 de 3 compras e último pedido;
  - churn: histórico, top 5 itens, o que parou de comprar e o roteiro de reconquista.
- A ficha tem linha do tempo única e correção manual com confirmação.

### Fatia 3 · Registro de visita
- Check-in com GPS. A mais de 150 m do pino, pergunta "corrigir o pino para cá?".
- Núcleo em 3 toques, pré-preenchido com o decisor e a janela já conhecidos.
- O motivo de não avanço só aparece quando o resultado não é avanço.
- Próxima ação sugerida com o porquê, confirmada com um toque. Um retorno vai para a lista do dia certo.
- Modelos por tipo de visita (aquisição, acompanhamento, reconquista). Check-out com os tempos do RF11.

### Fatia 4 · Hoje, priorização e rota
- Motor de sugestão: `pontos_esperados = pontos_valor × chance_hoje`, com o motivo de cada regra.
- Roteirizador no cliente: vizinho mais próximo com janelas, 2-opt e inserção mais barata. Considera base, jornada, almoço, funcionamento, janela do decisor, retornos com hora (restrição dura) e duração medida por tipo de visita.
- Lista "não couberam", com o motivo.
- Blocos fixos (retornos com hora, recompra vencendo, pontos novos), tirar ou adicionar com recálculo, replanejar a partir da posição atual e rota no Google Maps só por deep link.

### Fatia 5 · Mapa
- Leaflet/OSM em `vendor/`. Pinos com cor e letra por estado, legenda e filtros.
- Arrastar pino com confirmação, Click2Create (segurar no mapa ou "Estou aqui"), camada Desconhecidos e fila Descobrir (adicionar à lista ou descartar com motivo).
- O service worker guarda o Leaflet e um cache limitado de tiles já vistos.

### Fatia 7 · WhatsApp e cesta de entrada
- Mensagens prontas (recompra repetindo o último pedido, lembrete de 1ª compra e reconquista) por `wa.me` sem número. O `Contato` é gravado sozinho.
- Cesta de entrada por tipo: de 3 a 5 itens de uma categoria só, do catálogo fictício.

### Fatia 8 · Painéis
- Vendedor: pontos da semana contra a meta, funil contra o quartil de cima, retornos na janela do decisor e recompras em risco.
- Gestor: conversão por etapa e por vendedor (mapa de calor com o número na célula) e comportamento (hora, tempo no ponto, retorno na janela, voz, tempo do núcleo, registro no ponto). Mostra também o que os 2 de cima fazem diferente dos 2 de baixo. Equipe fictícia de 5 vendedores mais "Você".

### Fatia 6 · Voz
- Gravação de até 60 s (MediaRecorder) no IndexedDB, fila de transcrição com status visível no topo e reprocessamento quando volta o sinal.
- `api/transcrever.js`: transcrição e extração por LLM, com chave só no servidor e validação contra o catálogo.
- A IA sugere e o vendedor confirma com um toque. Campos preenchidos pela IA ficam marcados, e o áudio é apagado depois de transcrito.
- Modo demonstração sem chave: texto de exemplo e extração por regras no aparelho.

### Fechamento
- README com as decisões e os trade-offs, as premissas e o roteiro da demo.
- Export compatível com a V1, com "Compartilhar CSV".
- Script de H2 lendo o export da V2.
- Verificação a 360 e a 412 px (sem rolagem horizontal, alvos ≥ 48 px, botões com rótulo), teste offline (abre, registra visita, mapa com pinos, persiste) e migração da V1 no navegador.

### Não feito
- Fatia 9 (cruzamento Receita + Overture): fica como proposta documentada.
- Teste em Android real e Safari do iPhone.
