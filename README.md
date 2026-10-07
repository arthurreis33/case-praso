# Case RevOps Praso · Arthur Reis

Entrega do case para a vaga de Revenue Ops Analyst. Os três entregáveis pedidos estão neste repositório, e os links abaixo levam direto a cada um deles.

## Entregáveis

| Entregável | Onde está |
|---|---|
| **Protótipo publicado** | **[case-praso.vercel.app/?demo=1](https://case-praso.vercel.app/?demo=1)**, para abrir no celular |
| **Repositório do protótipo** | Este repositório, com o código em `public/` e o histórico das versões em [CHANGELOG.md](CHANGELOG.md) |
| **Playbook · um dia na vida** | [Playbook_Praso.pdf](Playbook_Praso.pdf) |
| **Diário de bordo** | [Diario_de_bordo_Praso.pdf](Diario_de_bordo_Praso.pdf) |

O link com `?demo=1` abre o protótipo já com os dados de exemplo, enquanto sem o parâmetro o app abre vazio, do jeito que o vendedor o veria no primeiro dia. O enunciado e os materiais recebidos da Praso não estão no repositório, porque são confidenciais.

## A aposta

A plataforma cobre o funil inteiro, mas a parte que mais mexe na conversão é um laço só. O vendedor registra, em três toques, o resultado da visita, quem decide a compra e em que horário essa pessoa costuma estar, e a plataforma devolve esse registro como um retorno marcado na janela do decisor, já encaixado na rota do dia certo. A etapa que esse laço move é a passagem de **visita efetiva para tomador de decisão**, que é onde a aposta diz que a carteira mais perde, já que hoje o vendedor volta ao ponto sem saber quando quem decide vai estar lá. O resto da plataforma existe para esse laço funcionar e para a recompra acontecer antes dos 45 dias.

Isso também responde à fala do time de que registrar só toma tempo, porque cada toque de hoje aparece como um card de amanhã, com o motivo escrito nele.

## O que a plataforma mostra, pede e devolve

**Mostra** a rota do dia com 8 a 12 pontos, a hora prevista e o porquê de cada um, além dos retornos, das recompras vencendo e dos pontos para conhecer, que ficam fora da rota. Mostra também a ficha de cada ponto, com estado, pontos, decisor, janela, "Da última vez", checklist de cadastro, cesta de entrada e histórico de compras, o funil de 6 etapas da carteira e a Semana, que compara o vendedor com o quartil de cima do time.

**Pede** o check-in e o check-out, com GPS, hora e tempo no ponto gravados sozinhos, os três toques do núcleo, o motivo quando a visita não avança e a confirmação da próxima ação, que já vem sugerida. A nota por voz é opcional.

**Devolve** o retorno na janela do decisor, o argumento da próxima visita a partir do motivo registrado, o pino corrigido pelo check-in, o "Não é ICP" fora da lista, a hora prevista da rota ajustada pelo tempo real de visita e o funil e os motivos da semana.

## Como avaliar em 3 minutos

Abra o link com `?demo=1`, que carrega 210 pontos fictícios em Boa Viagem, Pina e Imbiribeira. O simulador fica em Perfil → Modo demonstração → Abrir o simulador.

1. **O laço.** No Hoje, abra um lead da rota, faça o check-in, marque "Aberto sem decisor", deixe só a janela da manhã (9h–11h30) e toque em "Salvar e fazer check-out", e o aviso já mostra a volta na janela. No simulador, toque em **+1 dia**, que leva ao começo da jornada de amanhã, e veja o ponto de volta na rota, na hora da janela e com o motivo no card. Repetindo com "Falou com decisor" e o motivo "Preço", o retorno cai em 3 dias, também na janela, e a ficha passa a mostrar o "Da última vez".
2. **O Hoje.** A rota mostra hora e motivo, e os chips acima dela trazem o que ficou fora. Tocar em "Tirar" num ponto recalcula a rota, e depois do fim da jornada o Hoje passa a mostrar o plano de amanhã.
3. **A visita.** Com "Falou com decisor", o decisor e a janela já vêm preenchidos quando são conhecidos, e a próxima ação sugerida aparece com o porquê. No modo demonstração, a nota por voz gera uma sugestão de campos que se confirma com um toque.
4. **O card que se move sozinho.** Ainda na visita, toque em "Demonstração: simular cadastro feito" e volte à Carteira, no modo Funil, onde o ponto aparece na etapa Cadastro com o selo "avançou: cadastro detectado".
5. **O relógio.** No simulador, escolha um ponto em ativação e dispare um **Pedido assistido** e dois **Pedidos autônomos** para ele virar Recorrente e somar pontos. Depois, **+46 dias** leva quem não fez a 3ª compra autônoma para "Vencido", e alguns **+30** levam quem passou de 120 dias sem comprar para "Churn".
6. **A ficha de churn.** Mostra o histórico de compras, os itens mais comprados, o que o cliente parou de comprar antes de sair e o roteiro de reconquista, que começa pela categoria que ele mais comprava.
7. **O mapa.** Segure um pino para arrastá-lo e confirmar a nova posição, ou segure num ponto vazio do mapa para criar um estabelecimento ali.
8. **A Semana e a Equipe.** A Semana mostra os pontos contra a meta e o funil do vendedor contra os melhores do time, e a Visão do gestor, no Perfil, mostra o que os que convertem o dobro fazem diferente.

Em produção, cadastro, pedido e pagamento viriam da integração com o sistema de pedidos, e o simulador existe para mostrar que o card se move sem ninguém arrastar.

## Decisões de produto e seus trade-offs

**1. O ponto muda de etapa só por evento, e ninguém arrasta card.** As etapas 1 a 3 mudam pelo registro de visita, e as etapas 4 a 6 mudam por cadastro, pedido e tempo vindos do sistema, com cada mudança gravada junto com a causa. O ganho é um funil que mostra o que aconteceu, e não o que o vendedor declarou, o que importa porque a conversão por etapa é justamente o dado que revelou a diferença de 2x entre vendedores. O custo é que um erro de registro não se resolve arrastando, e por isso existe uma correção manual que pede confirmação, fica no histórico e não conta como avanço.

**2. O registro tem três toques, e só entra campo que muda a tela de amanhã.** O resultado, quem decide e a janela do decisor formam o núcleo, enquanto GPS, horário e tempo no ponto são gravados sozinhos. O ganho é um registro que cabe na porta do estabelecimento e que devolve algo ao vendedor. O custo é que muita coisa que um CRM tradicional pede ficou de fora, e a pesquisa sobre fornecedores e forma de pagamento saiu da tela da visita na V2.3.

**3. A priorização usa regras legíveis, e não um modelo preditivo.** A fórmula é pontos do ponto × chance de avançar hoje, com todos os pesos num único arquivo (`public/js/config.js`), e cada regra devolve o texto do motivo que aparece no card. O ganho é que o vendedor entende por que cada ponto está na lista e o gestor ajusta um número sem depender de um cientista de dados. O custo é que os pesos são palpites até existir histórico, e um modelo só faz sentido depois de meses de visitas bem registradas, que é exatamente o que a plataforma passa a produzir.

**4. Offline-first, sem backend.** Tudo é salvo no aparelho no mesmo toque, e o que precisa de rede, como a transcrição da voz, entra numa fila. O ganho é que cozinha e rua com sinal ruim não custam o dia de campo. O custo é que não há sincronização entre aparelhos nem login, e o backup é um export em JSON e CSV, o que serve a um protótipo, mas é obra de engenharia para produção.

**5. Mapa aberto (Leaflet e OpenStreetMap) no lugar do Google.** A coordenada do check-in passa a valer mais do que a do endereço, e o vendedor pode arrastar e confirmar o pino. O ganho é que o pino corrigido pertence à Praso e fica para sempre, o que os termos do Google não permitem quando o mapa não é dele. O custo é um mapa com menos detalhe comercial, e por isso o Google continua como atalho para a navegação por voz.

**6. A rota sai de uma heurística no próprio celular, e não de um solver.** O roteirizador usa vizinho mais próximo respeitando as janelas, seguido de uma passada 2-opt, com distância em linha reta corrigida por um fator de tortuosidade. O ganho é rodar offline, em milissegundos e sem API paga, com resultado próximo do ótimo para 15 pontos por dia. O custo é errar em rua de mão única e em ponte, e a interface já permite trocar por VROOM ou OSRM sem mexer na tela.

**7. Cliente em ativação é acompanhado por WhatsApp e só volta à rota quando a mensagem falha.** A rota leva o que depende de presença, e a recompra fica num bloco com a mensagem pronta para repetir o último pedido. O ganho é liberar a rota para aquisição e para retornos na janela do decisor. O custo é depender de uma regra ainda não calibrada, já que a visita só volta depois de dois dias sem pedido desde a mensagem.

**8. A nota por voz é do vendedor ao sair do ponto, e não a gravação da conversa.** A IA sugere os campos a partir da nota, o vendedor confirma com um toque e o áudio é apagado depois de transcrito. O ganho é não gravar o dono do estabelecimento, por respeito à LGPD e à confiança, e fugir do barulho da cozinha. O custo é que a evidência de que voz é mais rápida vem de um estudo em outro idioma, e por isso a voz é opcional e medida, com o ditado do teclado ao lado.

**9. Um simulador ocupa o lugar da integração com pedidos.** Cadastro, pedido e pagamento são disparados à mão no modo demonstração. O ganho é mostrar o card mudando sozinho sem acesso aos sistemas da Praso. O custo é que essa integração é a dependência número um da plataforma em produção, e sem ela a 3ª compra autônoma não é mensurável.

## Como provar que funciona

A proposta é um piloto de 45 dias, que é um ciclo de ativação, com parte dos vendedores na plataforma e o restante no Salesforce, usando como linha de base a conversão por etapa e por vendedor dos 90 dias anteriores. A métrica primária é a passagem de visita efetiva para decisor e de decisor para cadastro, e as secundárias são a 3ª compra autônoma em 45 dias e o tempo de registro. O critério de sucesso e o tamanho do grupo devem ser combinados com o gestor antes de começar, e os sinais de adoção são as visitas registradas no ponto, os retornos feitos na janela e o uso da nota por voz. O registro de visita e a rota são o que sai do Salesforce primeiro, enquanto pedidos e relatórios financeiros ficam lá até haver integração.

## O que é simulado e o que falta validar

Os 210 pontos de exemplo são fictícios, assim como a equipe de cinco vendedores e o catálogo. As regras estão implementadas de verdade, mas os valores, como pesos, faixas de pico e prazos de retorno, estão marcados como `PALPITE` no código, porque as visitas de campo foram poucas para calibrar qualquer número com segurança.

Algumas premissas dependem de resposta do gestor e mudam o comportamento da plataforma se estiverem erradas.

| Premissa | Como está no app | Onde muda |
|---|---|---|
| Os 45 dias contam desde a 1ª compra do ciclo | Sim, e depois do churn uma compra reinicia o ciclo | `config.js → ciclo` |
| "Autônoma" é o pedido sem a flag de assistido | A 3ª compra do ciclo, ou uma posterior, precisa ser autônoma | `estados.js` |
| Critério de alto potencial | Não MEI e tipo de alto consumo (restaurante, hamburgueria, pizzaria, lanchonete) | `config.js → alto_potencial` |
| O pedido do app chega sozinho ao sistema | Sim, e é o que o simulador imita | integração |
| "Conquistado" para a pontuação | Quando o ponto vira recorrente, porque a meta é recorrência e não cadastro | `config.js → conquista_em` |
| Ativação vencida que volta a comprar | Continua vencida até completar 120 dias sem comprar e virar churn | `estados.js` |
| Pedido via WhatsApp conta como autônomo | Hoje, só a flag decide | integração |
| Prazo de retorno por motivo de não avanço | De 2 a 7 dias, na janela do decisor quando o motivo pede, e "Não é ICP" sai da lista | `config.js → motivos` |
| Chance do cadastrado pela idade do cadastro | ×1,8 até 3 dias, ×1,3 até 10 dias e ×0,6 depois de 30 dias sem compra | `config.js → chance` |
| Ativação só vai à rota quando a mensagem falha | Contato de WhatsApp há 2 dias ou mais sem pedido depois dele | `config.js → chance.ativacao_visita` |
| Espera longa na rota vira intervalo | A partir de 60 minutos, com atalho para as mensagens de recompra | `config.js → rota.intervalo_longo_min` |

Uma pergunta ficou em aberto e pesa no argumento de venda, que é se existe limite de crédito pré-aprovado que o vendedor possa ver antes da visita. Os Termos de Uso dizem que o prazo depende de análise de crédito, e por isso a ficha hoje só avisa para não prometer prazo.

## Fora do escopo

Ficaram de fora o login e os múltiplos usuários, já que o vendedor é fixo e a visão do gestor abre pelo Perfil, além do backend com sincronização entre aparelhos, da integração real com pedidos e crédito, do Google Places, do solver de rota externo e do modelo preditivo. O cruzamento da base da Receita com o Overture Maps, que alimentaria a fila de pontos desconhecidos, ficou como proposta em [docs/PIPELINE_RECEITA_OVERTURE.md](docs/PIPELINE_RECEITA_OVERTURE.md), e no protótipo essa fila usa pontos fictícios. O app ainda não foi testado em Android real nem no Safari do iPhone, e a transcrição real com chave de API também não.

## Estrutura do repositório

```
README.md                    esta página
Playbook_Praso.pdf           Playbook · um dia na vida
Diario_de_bordo_Praso.pdf    Diário de bordo
CHANGELOG.md                 o que entrou em cada versão, da V1 à V2.3
public/                      o app publicado (HTML, CSS e JS, sem build)
  js/config.js               todas as regras ajustáveis, num lugar só
  js/estados.js              motor de estados e etapas
  js/prioridade.js           motor de sugestão, com o motivo de cada ponto
  js/rota.js · plano.js      roteirizador com janelas e plano do dia
  js/views/                  as telas
api/transcrever.js           função serverless de transcrição (chave só no servidor)
tests/                       101 testes automáticos
qa/                          testes no navegador
scripts/                     análise da H2 a partir do export
docs/                        planos das versões, auditoria da V2.1 e prints
```

## Como rodar

```bash
npm test        # 101 testes, sem dependências (node --test)
npm run dev     # serve public/ em http://localhost:5173
```

GPS e microfone só funcionam em HTTPS ou em `localhost`, então, no celular, o melhor caminho é o link publicado. Cada envio ao GitHub publica na Vercel, e a transcrição real é opcional, ligada pela variável `OPENAI_API_KEY` no projeto da Vercel. Sem ela, o app entra no modo demonstração.

---

Arthur Aragão · outubro de 2026
