# Campo Praso · V2.1

Protótipo da plataforma de campo do case RevOps da Praso. Arthur Aragão, outubro de 2026.

## O que o app faz

1. Monta o dia do vendedor: de 8 a 12 pontos em ordem de rota, com a hora prevista e o porquê de cada um ("Vale 3 pt · decisor costuma estar das 14h às 17h · 2/3 compras").
2. Registra a visita em até 3 toques. Cada registro muda a tela de amanhã: retorno na janela do decisor, próxima ação, pino corrigido.
3. Move o ponto no funil de 6 etapas **só por evento** (visita, cadastro, pedido, tempo). Ninguém arrasta card.
4. Mostra a ficha que o Salesforce não tem: estado, pontos, prazo dos 45 dias, decisor, histórico de compras e linha do tempo.
5. Funciona offline e com uma mão, e mostra o funil do vendedor contra o quartil de cima.

**Link:** `praso-campo-v1.vercel.app` (o mesmo domínio da V1; a V2 migra sozinha os dados do aparelho).
**Para avaliar com dados de exemplo:** `praso-campo-v1.vercel.app/?demo=1`.

## O que mudou na V2.1

A V2.1 é para vendedores da Praso testarem na rua. Por isso, nenhuma tela explica a si mesma: as decisões ficam neste README e em `docs/AUDITORIA_V2.md`, que tem a auditoria completa e a lista priorizada. Nenhuma função foi apagada; o que saiu da tela mudou de lugar.

- **Hoje:** a rota aparece logo abaixo do título. O que está fora da rota (retornos, recompras vencendo, pontos para conhecer) fica em chips, e cada card tem no máximo 3 linhas.
- **Perfil** (ícone do topo): Minha rota, Backup (o antigo "Exportar"), Visão do gestor, Dados de exemplo e Modo demonstração.
- **Modo demonstração:** `?demo=1`, 5 toques seguidos na logo ou Perfil. Só nele aparecem o simulador, o relógio e as marcas de dado de exemplo. Sem ele, a primeira abertura começa com a carteira vazia e boas-vindas.
- **Navegação:** toda tela por cima tem voltar no topo, todo ponto mostrado abre a ficha, e os links para a Carteira chegam já filtrados.
- **Identidade da Praso:** logo, azul `#2053CE`, Inter local e ícones Lucide.
- **Termos do vendedor:** Cadastrado, Ativando, Vencido, Churn, "pelo app", "pt prováveis". As chaves e o export não mudam.
- **Cadastro real:** o checklist da ficha segue o fluxo do app da Praso, com destaque para marcar "Vendedor da Praso" em "Como você conheceu?".

## Como rodar

```bash
npm test          # 67 testes, sem dependências (node --test)
npm run dev       # serve public/ em http://localhost:5173
```

GPS e microfone só funcionam em HTTPS ou em `localhost`. No celular, use o link publicado.

**Publicar:** cada envio ao GitHub publica na Vercel. O `vercel.json` publica `public/` sem build e sobe a função `api/transcrever.js`. A cada deploy, troque `VERSAO` em `public/sw.js`. O service worker serve do cache, e a versão nova aparece no segundo carregamento.

**Transcrição real (opcional):** defina `OPENAI_API_KEY` nas variáveis de ambiente do projeto na Vercel. Também dá para ajustar os modelos com `TRANSCRICAO_MODELO` (padrão `whisper-1`) e `EXTRACAO_MODELO` (padrão `gpt-4o-mini`). Sem chave, o app entra no **modo demonstração**. A chave nunca vai para o cliente.

## Demonstração em 3 minutos (simulador)

Abra o link com `?demo=1`: o app carrega 210 pontos fictícios em Boa Viagem, Pina e Imbiribeira. O **simulador** fica em Perfil → Modo demonstração → Abrir o simulador. Sem `?demo=1`, o app abre como o vendedor vê; para ver os dados de exemplo, toque em "Ver com dados de exemplo" nas boas-vindas.

1. **Hoje:** veja a rota com hora e motivo e, acima dela, os chips do que ficou fora (retornos, recompras vencendo, pontos para conhecer). Toque em "Tirar" num ponto: a rota é recalculada. Depois da jornada, o Hoje mostra o plano de amanhã.
2. **Visita:**
   - Abra um lead e faça o check-in.
   - Marque "Falou com decisor". O decisor e a janela já vêm do ponto, quando conhecidos.
   - Veja a próxima ação sugerida, com o porquê, e confirme com um toque.
   - Grave uma nota de voz: no modo demonstração, a IA sugere os campos e você confirma com um toque.
3. **Cadastro detectado:**
   - Ainda na visita, toque em "Demonstração: simular cadastro feito" e dispare **Cadastro feito**.
   - Volte à Carteira, no modo Funil. O card está na etapa Cadastro, com o selo "avançou: cadastro detectado".
4. **Relógio:**
   - No simulador, escolha um ponto em ativação, dispare **Pedido assistido** e depois **Pedido autônomo** duas vezes: ele vira Recorrente e soma pontos no Painel.
   - Toque em **+46 dias**: os pontos em ativação sem a 3ª compra autônoma viram "Vencido".
   - Toque em **+30** algumas vezes: quem passa de 120 dias sem comprar vira "Churn".
5. **Ficha de churn:** histórico de compras, top 5 itens, o que ele parou de comprar e o roteiro de reconquista, que começa pela categoria que mais comprava.
6. **Mapa:**
   - Segure um pino para arrastá-lo e confirme.
   - Segure no mapa para criar um ponto ali.
   - Ligue a camada "Desconhecidos".
7. **Semana:** os pontos da semana contra a meta e o funil contra os melhores do time. Em **Perfil → Visão do gestor**, o que os que convertem o dobro fazem diferente.

Em produção, cadastro, pedido e pagamento viriam da **integração com o sistema de pedidos**. O simulador existe para mostrar que o card se move sozinho.

## Decisões de produto e seus trade-offs

**1. Cards movidos só por evento.** O estado e a etapa saem de uma função pura (`estados.js`) que lê cadastro, pedidos, visitas e o relógio. Cada mudança grava um `EventoEstado` com a causa, e nada é apagado.
- *Ganho:* o funil é verdade, e não opinião. O vendedor não perde tempo arrastando card, e o gestor vê por que o ponto mudou.
- *Custo:* um erro de registro não se resolve arrastando. A única exceção é a **correção manual** de um registro errado, que exige confirmação, grava `correcao_manual` e não conta como avanço. Ela corrige a entrada (o resultado da visita ou o estado declarado de um ponto sem histórico), e o motor recalcula a partir daí.

**2. Leaflet + OpenStreetMap em vez do Google.**
- *Ganho:* os termos do Google Places proíbem usar o conteúdo dele em mapa que não seja do Google e limitam o cache a `place_id` e a 30 dias de coordenadas. Com OSM, o pino corrigido é nosso e fica para sempre. O Leaflet fica em `public/vendor`, então o mapa abre offline com os pinos.
- *Custo:* tiles do OSM têm menos detalhe comercial que o Google. Sem rede, só aparecem os tiles já vistos. O Google continua como deep link de navegação: "Abrir rota no Maps" passa as paradas para a navegação por voz.

**3. Heurística em vez de solver de rota.** Vizinho mais próximo respeitando janelas, ponderado pelos pontos esperados, seguido de uma passada 2-opt e de inserção mais barata do que sobrou (`rota.js`).
- *Ganho:* roda no celular, offline, em milissegundos, sem API paga. Para 15 pontos por dia, a diferença para o ótimo é pequena.
- *Custo:* não garante o ótimo e usa distância em linha reta × 1,4 de tortuosidade, não ruas reais. A interface `planejar(entrada) → saída` permite trocar por VROOM/OSRM sem mudar a tela.

**4. Regras em vez de modelo.** `pontos_esperados = pontos_valor × chance_hoje`, com multiplicadores transparentes num arquivo só (`config.js`). Cada regra devolve o texto do motivo.
- *Ganho:* o vendedor entende e confia, porque toda sugestão diz o porquê. O gestor ajusta um número sem cientista de dados.
- *Custo:* os pesos são palpites até haver histórico. Um modelo só faz sentido depois de meses de visitas registradas, e é exatamente isso que o app passa a produzir.

**5. Nota de voz do vendedor, e não gravação da conversa.** O vendedor grava até 60 s ao sair do ponto. A transcrição entra numa fila, a IA sugere os campos e ele confirma com um toque. O áudio é apagado depois de transcrito.
- *Ganho:* não grava o dono (LGPD e confiança) e evita o barulho de cozinha. O que a IA preencheu fica marcado com "IA" e nunca sobrescreve o que o vendedor marcou.
- *Custo:* depende da memória do vendedor. O ditado do teclado continua valendo para quem preferir.

**6. Offline-first sem backend.**
- *Persistência:* IndexedDB para tudo, com um diário síncrono no localStorage. Cada toque grava antes no diário, de forma síncrona, e depois numa transação curta do IndexedDB. Se a aba fechar no meio, a próxima abertura reaplica o diário. Sem IndexedDB, o app segue em memória e avisa em vermelho.
- *Ganho:* nada no fluxo de visita espera a rede, e o dado está salvo no instante do toque.
- *Custo:* não há sincronização entre aparelhos nem visão real do gestor. O export JSON/CSV é o backup, e o app avisa quantas visitas existem desde o último export.

**7. Simulador no lugar da integração.**
- *Ganho:* a banca vê a regra "nenhum card é movido à mão" acontecer, inclusive com o tempo, sem depender do sistema da Praso.
- *Custo:* os eventos são disparados à mão. Tudo o que é simulado aparece marcado: o selo do relógio no topo, "demonstração" na IA e "fictício" nos dados.

**Outras decisões:**
- **A plataforma só pede o que não sabe.** Decisor e janela já registrados no ponto vêm pré-preenchidos na visita. Nesse caso, o registro costuma ser um toque só (o resultado).
- **"Ponto fechado" e não "Fechado".** A chave `fechado` da V1 quer dizer *estabelecimento fechado*. Sem a troca de rótulo, a banca leria "Fechado" como venda.
- **Plano de amanhã à noite.** A partir de 1h30 antes do fim da jornada, o Hoje mostra o plano do dia seguinte. Quem abrir o link à noite vê um plano, e não uma lista vazia.
- **Retorno combinado vale mais que o horário padrão do tipo.** O horário de funcionamento registrado é regra. O padrão do tipo é palpite e perde para o que o vendedor combinou ou registrou.
- **Duração da visita:** a média medida no RF11 (a partir de 3 visitas) ou o padrão de `config.js`. Ela aparece em Perfil → Minha rota.
- **Rótulos de estado (V2.1):** a tela mostra Lead · Cadastrado · Ativando · Recorrente · Vencido · Churn. "Oportunidade", do case, aparece como explicação de Cadastrado e de Churn. A chave interna e o export continuam iguais.
- **Modo demonstração em vez de rótulo "fictício" por toda parte (V2.1):** o vendedor de teste não vê simulador nem marca de demo. Quem avalia abre com `?demo=1`.
- **Stack mantida:** HTML, CSS e JS puros, sem build. Nada obrigatório exigiu React, e um build acrescentaria risco ao service worker, a parte mais fácil de quebrar offline.

## Premissas a validar com o gestor

| Premissa | Como está no app | Onde muda |
|---|---|---|
| Os 45 dias contam desde a 1ª compra do ciclo | Sim; depois do churn, uma compra reinicia o ciclo | `config.js → ciclo` |
| "Autônoma" = pedido sem a flag de assistido | A 3ª compra do ciclo (ou uma posterior) precisa ser autônoma; se a 3ª for assistida, o ponto espera a próxima autônoma dentro do prazo | `estados.js` |
| Critério de alto potencial | Não MEI e tipo de alto consumo (restaurante, hamburgueria, pizzaria, lanchonete) | `config.js → alto_potencial` |
| Pedido do app chega sozinho ao sistema | Sim (é o que o simulador imita) | integração |
| "Conquistado" para a pontuação | Quando vira recorrente, porque a meta é recorrência e não cadastro | `config.js → conquista_em` |
| Ativação vencida que volta a comprar | Continua vencida até completar 120 dias sem comprar (vira churn) | `estados.js` |
| Pedido via WhatsApp conta como autônomo? | Hoje, só a flag decide | integração |

## Estrutura

```
public/                     o app (é o que vai ao ar)
  index.html, styles.css, sw.js, manifest.webmanifest, icon.svg
  img/                      logo e ícone do app, recortados do logo_praso.png do Project
  fonts/                    Inter Variable (OFL 1.1), a fonte do site da Praso
  vendor/leaflet/           Leaflet 1.9.4 (BSD-2)
  vendor/lucide/LICENSE     ícones Lucide (ISC), embutidos em js/icones.js
  js/config.js              TODAS as regras ajustáveis (pesos, picos, janelas, limiares, ciclo)
  js/estados.js             motor de estados e etapas (função pura)
  js/prioridade.js          motor de sugestão: pontos esperados + motivo
  js/rota.js · plano.js     roteirizador com janelas · plano do dia
  js/store.js · db.js       modelo de dados, EventoEstado, IndexedDB + diário
  js/migrar.js              V1 → V2 (localStorage da V1 ou export JSON)
  js/voz.js · extrair.js    gravação, fila, transcrição, extração e modo demonstração
  js/whatsapp.js            mensagens prontas e cesta de entrada
  js/painel.js              métricas do vendedor e do gestor (equipe fictícia)
  js/seed.js · demo/        dados e catálogo fictícios
  js/demo.js                modo demonstração (?demo=1, 5 toques na logo, Perfil)
  js/views/                 hoje, mapa, carteira, ficha, visita, novo, painel (Semana e Equipe), perfil, sim, descobrir
api/transcrever.js          função serverless: transcrição + extração por LLM (chave só no servidor)
tests/                      node --test: estados, rota, prioridade, store, migração, export, voz
scripts/h2_distancias.mjs   H2 em lote a partir do export JSON (V1 ou V2)
docs/                       PLANO_V2.md, AUDITORIA_V2.md (V2.1), prints/v2.1 (antes e depois) e a proposta Receita + Overture
```

## Modelo de dados (schema 2)

A entidade central é o **Ponto**, com estado e etapa. Visitas, pedidos, contatos e eventos ficam pendurados nele por `ponto_id`, e o histórico nunca se perde quando o estado muda.

- **Ponto:** CNPJ, razão social, nome fantasia, tipo, MEI e `pontos_valor` (calculado: MEI 0,5, não MEI 1, alto potencial 3). Tem endereço e coordenada cadastral, e uma `coord_confirmada`: a do check-in ou a do pino arrastado, que sempre prevalece. Guarda também horário de funcionamento, decisor (`papel` e `janela` em faixas e dias), quem paga, estado, etapa e origem.
- **Visita:** tipo (aquisição, acompanhamento ou reconquista), check-in com GPS, precisão e distância até o pino. Tem o núcleo (resultado, quem decide, janela, com início e fim para o RF11), motivo, próxima ação, nota (texto, origem e status da transcrição), `campos_ia`, pesquisa, surpresa e tempos.
- **Pedido** (sistema; no protótipo, seed e simulador): data, valor, itens, forma de pagamento e `autonomo`.
- **Contato:** gravado sozinho quando o vendedor toca em WhatsApp.
- **EventoEstado:** dimensão (estado ou etapa), de, para, causa e autor. Só acrescenta registros, nunca apaga.
- **Vendedor:** base, jornada com almoço e meta de pontos da semana.

**Migração:** na primeira abertura no mesmo domínio, a V2 lê a chave `praso_campo_v1`, migra e guarda no IndexedDB. A chave da V1 fica intacta. "Importar backup" aceita JSON da V1 e da V2. Campos da V1 sem par na V2 ficam com o sufixo `_v1`.

**Export:** fica em Perfil → Backup. O JSON traz o estado completo (`schema_version: 2`). O CSV tem uma linha por visita: as 55 colunas da V1 vêm primeiro, com os mesmos nomes e na mesma ordem, e as da V2 (`v2_*`) vêm depois. Atenção: `ponto_estado` passa a usar os 6 estados da V2. Há "Compartilhar planilha" e "Compartilhar backup" no menu do sistema. A V2.1 não mudou o modelo nem o export.

**H1 e H2 sem campo extra:**
- O tempo do núcleo (H1) é medido do primeiro toque até salvar.
- A distância entre o pino cadastral e o GPS do check-in (H2) vai para `v2_checkin_distancia_pino_m`.
- Com o endereço real do CNPJ, `scripts/h2_distancias.mjs` faz a medida em lote.

## Privacidade

- O app não coleta nome nem telefone pessoal do dono. O WhatsApp abre sem número, e o vendedor escolhe o contato no próprio aparelho.
- O repositório só tem dados fictícios. Os CNPJs do seed têm dígito verificador errado de propósito. O `.gitignore` bloqueia `*.csv`, os exports e `dados/`.
- O áudio atravessa a função serverless sem ser guardado e é apagado do aparelho depois de transcrito.

## Fora do escopo (e próximos passos)

- Login real e múltiplos usuários. O vendedor é fixo, e a visão do gestor abre pelo Perfil (em produção, vira papel do login).
- Backend e sincronização entre aparelhos.
- Integração real com pedidos e crédito (fica no simulador).
- Google Places, solver de rota externo e modelo preditivo.
- **Cruzamento Receita + Overture** (fatia opcional): ficou como proposta em `docs/PIPELINE_RECEITA_OVERTURE.md`. No protótipo, a fila Descobrir usa desconhecidos fictícios.
- **Ainda não testado:** Android real, Safari do iPhone (MediaRecorder grava em `audio/mp4`) e a chamada real da transcrição com chave.
