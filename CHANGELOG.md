# Changelog

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
