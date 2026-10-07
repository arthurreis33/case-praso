# Campo Praso · V2.3

Protótipo da plataforma de campo do case RevOps da Praso. Arthur Aragão, outubro de 2026.

## A aposta

- A parte que mais mexe na conversão é o laço entre o registro, a janela do decisor e a rota.
- O vendedor registra quem decide e quando essa pessoa está; a plataforma devolve o retorno na janela certa e a rota do dia.
- A etapa que esse laço move é a de **visita efetiva para decisor**.
- O resto da plataforma sustenta esse laço.

## O que a plataforma mostra, pede e devolve

**Mostra**
- **Hoje:** a rota de 8 a 12 pontos, com a hora prevista e o porquê de cada um, e, fora da rota, os retornos, as recompras vencendo e os pontos para conhecer.
- **Ficha:** estado, pontos, decisor e janela, "Da última vez", checklist de cadastro, cesta de entrada e histórico.
- **Carteira:** o funil de 6 etapas, com a passagem onde mais se perde.
- **Semana:** pontos contra a meta, funil contra o quartil de cima, % de retornos na janela e os motivos da semana.

**Pede**
- Check-in e check-out, com GPS, hora e tempo no ponto gravados sozinhos.
- Três toques: o resultado, quem decide e quando essa pessoa está.
- O motivo, quando a visita não avança.
- A confirmação da próxima ação, que já vem sugerida.
- A nota por voz, que é opcional.

**Devolve**
- O retorno na janela do decisor, já na rota do dia certo.
- O argumento do motivo na próxima visita ("Da última vez").
- O pino corrigido pelo check-in.
- O "Não é ICP" fora da lista.
- O tempo no ponto, que acerta a hora prevista da rota.
- O funil e os motivos na Semana.

## O que o app faz

1. Monta o dia do vendedor: de 8 a 12 pontos em ordem de rota, com a hora prevista e o porquê de cada um ("Vale 3 pt · decisor costuma estar das 14h às 17h · 2/3 compras").
2. Registra a visita em até 3 toques. Cada registro muda a tela de amanhã: retorno na janela do decisor, próxima ação, pino corrigido.
3. Move o ponto no funil de 6 etapas **só por evento** (visita, cadastro, pedido, tempo). Ninguém arrasta card.
4. Mostra a ficha que o Salesforce não tem: estado, pontos, prazo dos 45 dias, decisor, histórico de compras e linha do tempo.
5. Funciona offline e com uma mão, e mostra o funil do vendedor contra o quartil de cima.

**Link para avaliar:** `https://case-praso.vercel.app/?demo=1`, que abre com os dados de exemplo.

## Como rodar

**O link para avaliar é `https://case-praso.vercel.app/?demo=1`.** Sem o parâmetro, o app abre vazio, como o vendedor o vê.

```bash
npm test          # 101 testes, sem dependências (node --test)
npm run dev       # serve public/ em http://localhost:5173
```

GPS e microfone só funcionam em HTTPS ou em `localhost`. No celular, use o link publicado.

**Publicar:** cada envio ao GitHub publica na Vercel. O `vercel.json` publica `public/` sem build e sobe a função `api/transcrever.js`. A cada deploy, troque `VERSAO` em `public/sw.js`. O service worker serve do cache, e a versão nova aparece no segundo carregamento.

**Transcrição real (opcional):** defina `OPENAI_API_KEY` nas variáveis de ambiente do projeto na Vercel. Também dá para ajustar os modelos com `TRANSCRICAO_MODELO` (padrão `whisper-1`) e `EXTRACAO_MODELO` (padrão `gpt-4o-mini`). Sem chave, o app entra no **modo demonstração**. A chave nunca vai para o cliente.

## Demonstração em 3 minutos (simulador)

Abra o link com `?demo=1`: o app carrega 210 pontos fictícios em Boa Viagem, Pina e Imbiribeira. O **simulador** fica em Perfil → Modo demonstração → Abrir o simulador. Sem `?demo=1`, o app abre como o vendedor vê; para ver os dados de exemplo, toque em "Ver com dados de exemplo" nas boas-vindas.

1. **O laço, em 1 minuto:** no Hoje, abra um lead da rota, faça o check-in, marque "Aberto sem decisor", deixe marcada só a janela da manhã (9h–11h30) e toque em "Salvar e fazer check-out"; o aviso mostra a volta já na janela. No simulador, toque em **+1 dia**, que leva ao começo da jornada de amanhã: o ponto está na rota de hoje, na hora da janela, com o motivo no card. Na Semana, veja a % de retornos na janela. Repita com "Falou com decisor" e o motivo "Preço" para ver o retorno em 3 dias, na janela, e o "Da última vez" na ficha.
2. **Hoje:** veja a rota com hora e motivo e, acima dela, os chips do que ficou fora (retornos, recompras vencendo, pontos para conhecer). Os clientes em ativação ficam no chip de recompras, com o WhatsApp, porque a rota só leva o que depende de presença, salvo quando a mensagem não gerou pedido (aí o card diz "mensagem sem pedido há N dias"). Uma espera longa na rota aparece como intervalo, a hora das mensagens. Toque em "Tirar" num ponto: a rota é recalculada. Depois da jornada, o Hoje mostra o plano de amanhã.
3. **Visita:**
   - Abra um lead e faça o check-in.
   - Marque "Falou com decisor". O decisor e a janela já vêm do ponto, quando conhecidos.
   - Veja a próxima ação sugerida, com o porquê, e confirme com um toque.
   - Toque em "Salvar e fazer check-out" e grave uma nota de voz: no modo demonstração, a IA sugere os campos e você confirma com um toque.
4. **Cadastro detectado:**
   - Ainda na visita, toque em "Demonstração: simular cadastro feito" e dispare **Cadastro feito**.
   - Volte à Carteira, no modo Funil. O card está na etapa Cadastro, com o selo "avançou: cadastro detectado".
5. **Relógio:**
   - No simulador, escolha um ponto em ativação, dispare **Pedido assistido** e depois **Pedido autônomo** duas vezes: ele vira Recorrente e soma pontos no Painel.
   - Toque em **+46 dias**: os pontos em ativação sem a 3ª compra autônoma viram "Vencido".
   - Toque em **+30** algumas vezes: quem passa de 120 dias sem comprar vira "Churn".
6. **Ficha de churn:** histórico de compras, top 5 itens, o que ele parou de comprar e o roteiro de reconquista, que começa pela categoria que mais comprava.
7. **Mapa:**
   - Segure um pino para arrastá-lo e confirme.
   - Segure no mapa para criar um ponto ali.
   - Ligue a camada "Desconhecidos".
8. **Semana:** os pontos da semana contra a meta e o funil contra os melhores do time. Em **Perfil → Visão do gestor**, o que os que convertem o dobro fazem diferente.

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

**8. O campo calibra regras, não dados (V2.2).** O que se aprende na rua entra como regra e texto em `config.js` e nos catálogos, nunca como ponto na carteira. A plataforma é um cenário simulado: as regras funcionam de verdade, e os valores são palpites assumidos.
- *Ganho:* uma observação muda o comportamento de todos os pontos de uma vez, e os dados de exemplo continuam fictícios.
- *Custo:* as visitas de campo foram poucas para recalibrar com segurança. Picos, funcionamento, papéis, motivos, canais e cesta seguem marcados `PALPITE`, e a calibração ficou para os próximos passos.

**9. O motivo vira a próxima ação (V2.2).** O motivo de não avanço era gravado e só aparecia no histórico. Agora cada motivo tem, em `CONFIG.motivos`, uma próxima ação, um argumento e um porquê.
- *Ganho:* a etapa de decisor para cadastro passa a mudar a tela de amanhã. Ela gera um retorno no prazo do motivo, mostra "Da última vez" na ficha e no card e tira o "Não é ICP" da lista. O gestor vê por que cada vendedor perde e separa motivo do cliente de motivo de execução.
- *Custo:* um toque a mais na visita sem avanço. Os prazos e as frases ainda não foram validados, e um motivo mal marcado gera um retorno errado (o vendedor troca com um toque).

**10. O cadastro não é o fim da visita (V2.2).** Com o cadastro feito durante a visita, o objetivo vira o 1º pedido ali, com a cesta de entrada. O cadastrado recente sobe na rota, e o antigo esfria.
- *Ganho:* segue o case, que põe a 1ª compra "no app, com apoio". A visita aproveita o momento em que o dono já está com o app aberto.
- *Custo:* a visita que dá certo fica mais longa. Os multiplicadores (1,8, 1,3 e 0,6) são PREMISSA, sem dado por trás.

**11. Ativação fica fora da rota por padrão (V2.3).** O cliente entre a 1ª e a 3ª compra é acompanhado por mensagem, no chip de recompras do Hoje, e só volta à rota quando a mensagem de WhatsApp não gerou pedido em 2 dias. Um ponto em ativação posto à mão pelo vendedor continua na rota.
- *Ganho:* a rota gasta presença só onde ela muda a etapa, e a compra continua autônoma, que é a que conta para a meta. Antes, um cliente em ativação de 3 pt sempre vencia um lead de 3 pt em pontos esperados, e a visita era justamente o que podia tornar a 3ª compra assistida.
- *Custo:* para saber se a mensagem funcionou, a plataforma depende da integração com pedidos e do registro dos contatos. O prazo de 2 dias ainda não foi validado.

**Outras decisões:**
- **A plataforma só pede o que não sabe.** Decisor e janela já registrados no ponto vêm pré-preenchidos na visita. Nesse caso, o registro costuma ser um toque só (o resultado).
- **"Ponto fechado" e não "Fechado".** A chave `fechado` da V1 quer dizer *estabelecimento fechado*. Sem a troca de rótulo, a banca leria "Fechado" como venda.
- **Plano de amanhã à noite.** A partir de 1h30 antes do fim da jornada, o Hoje mostra o plano do dia seguinte. Quem abrir o link à noite vê um plano, e não uma lista vazia.
- **Retorno combinado vale mais que o horário padrão do tipo.** O horário de funcionamento registrado é regra. O padrão do tipo é palpite e perde para o que o vendedor combinou ou registrou.
- **Duração da visita:** a média medida no RF11 (a partir de 3 visitas) ou o padrão de `config.js`. Ela aparece em Perfil → Minha rota.
- **Rótulos de estado (V2.1):** a tela mostra Lead · Cadastrado · Ativando · Recorrente · Vencido · Churn. "Oportunidade", do case, aparece como explicação de Cadastrado e de Churn. A chave interna e o export continuam iguais.
- **Modo demonstração em vez de rótulo "fictício" por toda parte (V2.1):** o vendedor de teste não vê simulador nem marca de demo. Quem avalia abre com `?demo=1`.
- **Stack mantida:** HTML, CSS e JS puros, sem build. Nada obrigatório exigiu React, e um build acrescentaria risco ao service worker, a parte mais fácil de quebrar offline.

## Como provar que funciona

- **Piloto:** [a definir] vendedores com a plataforma e o restante no Salesforce, durante 45 dias (um ciclo de ativação).
- **Linha de base:** conversão por etapa e por vendedor no Salesforce, nos 90 dias anteriores (positivo P19).
- **Métrica primária:** passagem de visita efetiva para decisor e de decisor para cadastro.
- **Métricas secundárias:** 3ª compra autônoma em 45 dias e tempo de registro.
- **Critério de sucesso:** ganho mínimo por etapa de [a definir], combinado com o gestor antes de começar.
- **Sinais de adoção:** visitas registradas no ponto, retornos feitos na janela e notas por voz.
- **O que sai do Salesforce primeiro:** registro de visita e rota.
- **O que fica até haver integração:** pedidos e relatórios financeiros.

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
| Prazo de retorno por motivo de não avanço (V2.2) | De 2 a 7 dias, na janela quando o motivo pede; "Não é ICP" sai da lista | `config.js → motivos` |
| Chance do cadastrado pela idade do cadastro (V2.2) | ×1,8 até 3 dias, ×1,3 até 10 dias, ×0,6 depois de 30 dias sem compra | `config.js → chance` |
| Ativação só vai à rota quando a mensagem falha (V2.3) | Contato de WhatsApp há 2 dias ou mais sem pedido depois dele | `config.js → chance.ativacao_visita.dias_sem_pedido_apos_contato` |
| Espera longa na rota vira intervalo (V2.3) | A partir de 60 min, com o atalho para as mensagens de recompra | `config.js → rota.intervalo_longo_min` |

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
tests/                      node --test: estados, rota, plano, prioridade, store, migração, export, voz, seed
scripts/h2_distancias.mjs   H2 em lote a partir do export JSON (V1 ou V2)
docs/                       PLANO_V2.md, PLANO_V2_3.md, AUDITORIA_V2.md (V2.1), prints/v2.1 (antes e depois) e a proposta Receita + Overture
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
- **Calibrar as regras de comportamento com mais campo (V2.2):** picos e funcionamento por tipo, papéis de quem decide, motivos de não avanço, gatilhos de troca, canais e cesta de entrada por tipo continuam como palpites de um cenário simulado. As visitas de campo foram poucas para trocar esses valores com segurança. Estão marcados `PALPITE` em `config.js`, `catalogo.js` e `demo/catalogo.js`, e cada um muda num lugar só.
- **Ainda não testado:** Android real, Safari do iPhone (MediaRecorder grava em `audio/mp4`) e a chamada real da transcrição com chave.
