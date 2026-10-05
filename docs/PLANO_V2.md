# Plano da V2 · plataforma de campo Praso

Escrito em 05/10/2026, à noite, depois de ler a V1 inteira. **Status: aprovado em 05/10, com as decisões da seção 4.**

## 0. O que a leitura da V1 mostrou

- São 23 arquivos e cerca de 1.200 linhas de JS. Os 29 testes passam (`npm test`, 0,3 s).
- O remoto é `github.com/arthurreis33/case-praso`, e não `praso-campo-v1` como diz a passagem. O README publicado termina com `# c a s e - p r a s o` em UTF-16, que é sujeira de um `echo >> README.md` no PowerShell. Corrijo isso na V2.
- Em `RESULTADOS`, `fechado` quer dizer **estabelecimento fechado**, e não negócio fechado. Na V2 o rótulo vira "Ponto fechado" e a chave continua a mesma. Sem essa troca, a banca vai ler "Fechado" como venda.
- Na ficha da V1, o estado no funil e o status do dia são chips editáveis à mão, o que viola o princípio 3. Os dois saem da V2.
- `store.js` já tem o ponto de extensão `migrar()` e grava `schema_version`, então a migração entra sem gambiarra.

## 1. O que reaproveita da V1

| Peça da V1 | Na V2 |
|---|---|
| `store.js`: gravação síncrona a cada toque, fallback em memória, cópia de JSON corrompido, importar backup | Fica. Ganha pedidos, contatos, eventos e o motor de estados. |
| `rules.js`: `proximaOcorrencia`, `calcularRetorno`, `duracoes`, `distanciaM` | Fica igual e ganha regras novas (estados, prioridade, rota) em arquivos separados e puros. |
| Laço de retorno (`status_dia = retornar`, `retorno_previsto`, desvio) | Vira o bloco "Retornos com hora" do Hoje e uma restrição dura do roteirizador. |
| Tela de visita: núcleo em 3 toques (RF06), relógios do RF11, pesquisa (RF07), surpresa (RF08) | Fica. Entram check-in com correção de pino, motivo de não avanço, próxima ação, tipo de visita e nota por voz. A pesquisa vira o bloco recolhido da seção 2 do prompt, mantendo os caminhos de campo da V1. |
| `catalogo.js`, `ui.js` (chips, `quando`, toast), `geo.js` | Fica. |
| `export.js` | O CSV mantém as 55 colunas da V1 **na mesma ordem e com os mesmos nomes**, e as novas entram no fim. O JSON passa a ter `schema_version: 2`. |
| `sw.js` (cache primeiro) | Fica. Passa a guardar o Leaflet, que fica em `public/vendor/` (licença BSD-2), e um cache limitado dos tiles já vistos. |
| `scripts/h2_distancias.mjs` | Continua rodando com export V1 e V2. Dentro do app, a distância passa a sair sozinha quando o ponto tem coordenada cadastral. |
| Testes (`node --test`) | Ficam todos, adaptados à migração. Entram os testes das transições. |

O que é reescrito: `lista.js` vira **Hoje**, `ponto.js` vira a **ficha por estado** e o roteador ganha as 4 abas.

**Stack:** mantenho HTML, CSS e JS puros, sem build. Nada obrigatório na V2 exige React. Leaflet, IndexedDB, MediaRecorder e as funções da Vercel funcionam sem framework, e um build agora só acrescentaria risco ao service worker com dois dias de prazo. A transcrição fica em `api/transcrever.js`, uma função serverless da Vercel que convive com `outputDirectory: public`.

## 2. O que muda no modelo de dados (schema_version 2)

### Ponto

| V1 | V2 | Regra da migração |
|---|---|---|
| `nome` | `nome_fantasia` | cópia |
| `endereco` | `endereco_cadastral` | cópia |
| `lat`, `lng`, `precisao_m`, `coord_fonte` | `coord_confirmada {lat, lng, precisao_m, origem}` se `coord_fonte = checkin`; senão `coord_cadastral` | a coordenada do check-in sempre prevalece |
| `estado` (lead, oportunidade, cliente, churn) | `estado` (6 estados da seção 5) | lead → `lead`; oportunidade → `cadastrado_sem_compra`; churn → `churn`; cliente → `recorrente`, com `estado_v1` guardado. Sem pedido no histórico, o motor não rebaixa um estado migrado: ele só muda com evento novo. |
| `origem` (lista, rua) | `origem` (base_praso, receita, mapa_aberto, campo) | as duas viram `campo`, e `origem_v1` é guardado |
| `decisor {quem, faixas, dias}` | `decisor {papel, janela {dias[], faixas[]}}` | ver a dúvida 5 |
| `status_dia`, `retorno_sugerido`, `retorno_motivo`, `ficticio` | iguais | cópia |
| — | `cnpj`, `razao_social`, `cnae`, `situacao`, `mei`, `alto_potencial`, `horario_funcionamento`, `quem_paga`, `etapa_funil`, `vendedor_id`, `atualizado_em` | vazios na migração; `quem_paga` sai da pergunta 2 da última visita |
| — | `pontos_valor` | **calculado, não gravado**: 0,5 para MEI, 1 para não MEI e 3 para alto potencial. Sem MEI informado, vale 1. |

### Visita

O que muda: entram `tipo` (aquisicao, acompanhamento, reconquista, inferido do estado no check-in), `planejada_para`, `motivo_nao_avanco`, `proxima_acao {tipo, data_hora}`, `nota_texto`, `nota_origem`, `transcricao_status`, `campos_ia[]` (o que a IA preencheu) e `tempos` (gravados no check-out, além de recalculados no export).

O que fica igual: `checkin`/`checkout` continuam com o campo `em`, que é o `ts` do prompt. Não troco o nome, porque quebraria o script de H2 e o CSV sem ganho nenhum. Também ficam `nucleo` (resultado, quem decide, faixas, dias, início e fim), `pesquisa` com os caminhos da V1 (mais `pesquisa.troca.o_que_faria_trocar`), `surpresa`, `observacao`, `versao_conversa` e `retorno_previsto`. `registro_modo` passa a se chamar `nota_origem` e aceita voz, digitação ou misto.

### Entidades novas

- `pedidos`, `contatos`, `eventos` (EventoEstado, só acrescenta e nunca apaga) e `vendedores` ficam no mesmo estado, como listas penduradas por `ponto_id`.
- `config.relogio_offset_dias` é o relógio do simulador.

**Motor de estados.** É uma função pura `avaliar(ponto, pedidos, cadastro, hoje)` que devolve o estado e a etapa. O store compara com o que está gravado e, se mudou, grava o `EventoEstado` com a causa. O motor roda em três momentos: quando chega um evento do simulador, quando o relógio avança e quando o app abre (é o que faz o churn aparecer sozinho).

**Configuração.** Tudo o que é regra ajustável fica num arquivo só, `public/js/config.js`:

- pesos da `chance_hoje`;
- picos por tipo de estabelecimento;
- critério de alto potencial;
- duração padrão da visita por tipo;
- velocidade e fator de tortuosidade;
- N dias sem avanço;
- limiares de 150 m (correção de pino) e 50 m (deduplicação).

**Migração.** `migrar()` converte v1 em v2 por função pura, testada com uma fixture da V1. A V2 roda no mesmo domínio da V1 (decisão 1). Por isso, na primeira abertura, ela lê sozinha a chave `praso_campo_v1` do localStorage, migra e grava no IndexedDB. A chave da V1 fica intacta como backup. "Importar backup" também aceita um JSON da V1.

**Persistência (decisão 3: IndexedDB para tudo).** Cada coleção é um object store, e cada toque grava só os registros que mudaram, numa transação curta.

- Para não perder a garantia da V1 de que o dado está salvo no instante do toque, os registros alterados vão antes, de forma síncrona, para um diário pequeno no localStorage (`praso_v2_diario`). O diário é limpo quando a transação do IndexedDB confirma.
- Se a aba fechar no meio, a próxima abertura reaplica o diário.
- Sem IndexedDB, o app segue em memória e avisa em vermelho, como na V1.
- Os testes em Node usam um adaptador em memória com a mesma interface.

## 3. Ordem das fatias

| # | Fatia | Tempo | Ao final, publicado |
|---|---|---|---|
| 1 | Modelo, estados, migração, seed e simulador com relógio | 2h | 4 abas (as que não estão prontas mostram "em construção"), a Carteira em lista simples e o simulador movendo estados. Testes de 45 dias, 120 dias, retorno de churn e compra autônoma ou assistida. |
| 2 | Carteira e ficha | 2h | Funil vertical com o selo "avançou", lista com busca e filtros, adicionar ponto com BrasilAPI e deduplicação, e a ficha por estado com a linha do tempo. |
| 3 | Registro de visita | 2h | Check-in com a pergunta "corrigir o pino?", núcleo em 3 toques, motivo, próxima ação, modelos por tipo de visita e tempos. |
| 4 | Hoje, priorização e rota | 2h30 | Lista sugerida com o motivo de cada ponto, roteirizador (inserção mais 2-opt), pontos que não couberam, blocos fixos e replanejar. |
| 5 | Mapa | 1h30 | Leaflet/OSM, pinos com cor e ícone, legenda, filtros, arrastar pino, Click2Create e a camada "Desconhecidos" com a fila Descobrir alimentada pelo seed. |
| 7 | WhatsApp e cesta de entrada | 45 min | Três modelos de mensagem, `Contato` gravado sozinho e cesta por tipo. |
| 8 | Painéis | 1h30 | Painel do vendedor e painel do gestor com 6 vendedores fictícios. |
| 6 | Voz | 1h30 | Gravação, fila, transcrição, extração e modo demonstração. |
| 9 | Receita + Overture | até 3h | **Fora**, a não ser que sobre tempo depois de quarta às 14h. O pipeline fica documentado como proposta. |

Mudanças em relação à seção 10 do prompt:

- **A fatia 7 sobe para antes da 6.** Ela custa 45 minutos e mostra o princípio "o registro devolve algo". A voz custa o dobro, depende de chave e tem a demo mais frágil.
- **A fatia 6 depende do veredito de H3.** Se o campo refutou a nota por voz (por exemplo, por causa do barulho de cozinha), ela sai e o tempo vai para acabamento e testes.
- A fila Descobrir entra na fatia 5, com desconhecidos fictícios do seed. Assim a camada funciona sem a fatia 9.

**Calendário:**

- **Segunda à noite:** este plano e a fatia 1.
- **Terça:** fatias 2, 3 e 4.
- **Quarta até 18h:** fatias 5, 7, 8 e, se der, a 6.
- **Quarta das 18h às 20h:** congelamento do código, README, CHANGELOG, teste a 360 px e a 412 px e o deploy final.
- Depois das 20h de quarta o código não muda mais, e o tempo fica livre para os outros documentos do case.

**Como publico (decisão 4):** nada vai ao Git por mim. Cada fatia termina com os testes passando e o app rodando no Chromium a 360 px e a 412 px. Os commits pequenos ficam no meu ambiente. No fim, entrego os arquivos na pasta `praso-campo-v1` do seu computador, e você sobe para o repositório.

## 4. Decisões e premissas

Respondidas por você em 05/10:

1. **Repositório:** o mesmo `case-praso`. A V2 substitui a V1 no mesmo link e migra os dados do aparelho sozinha.
2. **Bairros do seed:** Boa Viagem, Pina e Imbiribeira.
3. **Persistência:** IndexedDB para tudo, com o diário síncrono descrito na seção 2.
4. **Publicação:** você sobe para o Git quando eu terminar.

Premissas que adotei e que ficam marcadas no README:

5. **Janela do decisor.** Fica em faixas, como os chips da V1 (6h–9h, 9h–11h30…), e não como um único intervalo de início e fim. Assim duas faixas separadas, como manhã e noite, não viram "das 6h às 20h". O roteirizador lê cada faixa como um intervalo.
6. **"3ª compra autônoma".** O ponto vira `recorrente` quando, dentro de 45 dias desde a 1ª compra, faz um pedido sem a flag de assistido que seja o 3º pedido do ciclo ou um posterior. Se o 3º pedido for assistido, ele continua em ativação até vir um pedido autônomo dentro do prazo.
7. **Ativação vencida que volta a comprar.** Continua em `ativacao_vencida` até completar 120 dias sem comprar, quando vira churn. Só uma compra a partir do churn reinicia o ciclo. É uma premissa para o gestor, porque um cliente que compra toda semana e aparece como "vencido" é estranho.
8. **Material do campo.** Nenhum item bloqueia, mas mudam a V2:
   - o export JSON da V1 me deixa testar a migração com dado real, que fica fora do git;
   - os tempos medidos no RF11 viram a duração padrão da visita;
   - os vereditos de H1 a H7 decidem a fatia 6 e o texto das decisões no README;
   - as respostas do gestor viram premissas confirmadas.
9. **Transcrição e LLM.** O modo demonstração vem por padrão e não exige chave. Se você quiser transcrição real, preciso saber qual provedor você tem chave, e ela vai só para as variáveis de ambiente da Vercel.
10. **"Conquistado" para a pontuação.** O ponto conta para a meta quando vira `recorrente`, e não no cadastro, porque a meta é a recorrência.
