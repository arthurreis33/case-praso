# Plano da V2.3 · ajustes de coerência

Cinco ajustes cirúrgicos sobre a V2.2, na ordem A, B, C, D e E. Nada fora deles muda; o que pareceu precisar mudar e ficou de fora está no fim, em "Fora do escopo".

## A · motivo de não avanço respeita a janela do decisor

- `config.js` → `motivos.preco`, `motivos.quer_prazo` e `motivos.vai_pensar` ganham `janela: true` em `proxima` (os `dias` ficam 3, 3 e 2) e ", na janela dele" no fim do `porque`. `proxima.js` não muda.
- `tests/motivos.test.mjs` → as expectativas desses três passam de 11h (abertura + 1h) para 14h (a janela do ponto do teste), e entram os três casos de aceite (9h às 11h30 com "Preço", 14h às 17h com "Vai pensar" e os três sem janela caindo na abertura).
- Efeito esperado no seed, que usa `sugerirProximaAcao`: os retornos desses motivos passam para a janela, e a rota do Hoje muda sozinha.

## B · cliente em ativação sai da rota por padrão

- `config.js` → `chance.ativacao_visita.dias_sem_pedido_apos_contato: 2` e `rota.intervalo_longo_min: 60`, ambos marcados `PREMISSA (V2.3)`.
- `prioridade.js` → em `avaliarPrioridade`, quando o ponto está em ativação com recompra vencendo, olha o último contato de WhatsApp e os pedidos depois dele. Se o contato tem pelo menos 2 dias e não houve pedido, devolve `visitaAposMensagem: true` e acrescenta aos `motivos` "mensagem sem pedido há N dias: vale a visita". A chance não muda.
- `plano.js` → em `resto`, sai quem tem `sit.estado === 'ativacao'` sem `visitaAposMensagem`. `duros` e `fixos` não mudam.
- `views/hoje.js` → parada com `espera_min` ≥ 60 ganha, antes do card, a linha "Intervalo de ~N h · bom momento para as M mensagens de recompra" (que abre o chip de recompras) ou "Intervalo de ~N h antes da próxima parada", e o card deixa de mostrar "Espera N min". Esperas menores ficam como estão. Um estilo novo pequeno em `styles.css` para a linha.
- `seed.js` → dois pontos em ativação com recompra vencendo, contato de WhatsApp de 3 dias atrás e nenhum pedido depois, para a exceção aparecer na rota.
- Testes novos (`tests/plano.test.mjs`): ativação fora por padrão, exceção do contato sem pedido (com o motivo no card) e ponto em ativação posto à mão continua na rota.

## C · os dados de exemplo contam a mesma história da tese

- `views/painel.js` → `topo = ord.slice(0, n)` e os quatro "2" fixos dos textos viram `topo.length` e `base.length`.
- `seed.js` → calibração do funil e do comportamento do "Você" (ver a conta abaixo). `equipeFicticia()` não muda.
- Testes novos (`tests/seed.test.mjs`): com o seed carregado e o plano do dia gerado, "Visitada → Decisor" é a etapa de maior perda, pelo menos 10 p.p. abaixo do quartil de cima, e é também a pior passagem da Carteira; os de cima são 2 nomes sem o "Você"; os retornos na janela do "Você" ficam abaixo dos de B e C; e `topo` tem `Math.round(n_vendedores / 4)` nomes (pelo HTML de `renderGestor`).

**A conta que obriga a mexer na distribuição de estados.** O funil conta quantos pontos chegaram a cada etapa (≥ k), e todo ponto cadastrado conta como visitado e decisor, mesmo sem visita. Hoje são 107 pontos cadastrados ou além (Cadastrado 30, Ativando 30, Recorrente 35, Vencido 12). Com as faixas pedidas, `Cadastro = Visitada × 0,575 × 0,685 ≈ 0,39 × Visitada`, e como `Visitada ≤ Planejada ≤ 210`, o máximo de pontos cadastrados que cabe é perto de 73. Por isso só acrescentar visitas "aberto sem decisor" não basta, e o seed passa a ter menos pontos em Cadastrado, Ativando e Vencido e mais leads visitados (sem decisor e com decisor), mantendo os 210 pontos, os três bairros e o determinismo. Também entra `planejado_em` em alguns leads ainda não visitados, que é o que faz "Planejada → Visitada" ficar entre 85% e 92%.

## D · a tela de visita perde a instrumentação da pesquisa

- `config.js` → `visita.pesquisa_de_campo: false`.
- `views/visita.js` → com `false`, não renderiza o `<details id="bloco-pesquisa">` nem a seção "O que me surpreendeu aqui"; `htmlPesquisa` continua no arquivo. O chip "A nota foi por" sai da tela. A seção da nota ganha `id="nota"`, e o check-out rola para ela. A barra antes do check-out tem um só botão principal, "Salvar e fazer check-out" com resultado ou "Check-out" sem ele (com o diálogo atual). O aviso desse botão passa a dizer a volta ("Check-out feito · volta sex 09/10 14:00"), porque o aviso do "Salvar registro" isolado deixa de existir. O texto do resumo "Toque em Salvar registro." vira "Toque em Salvar e fazer check-out.". Depois do check-out, nada muda.
- `store.js` → a inferência de `nota_origem` passa a morar no store. Em `setCampo('nota_texto', …)` com texto, vira `digitacao`, ou `misto` se já havia voz; em `registrarAudio`, vira `voz`, ou `misto` se já havia digitação. Hoje `registrarAudio` decide pelo texto da nota, o que marca `misto` numa segunda gravação depois da transcrição da primeira; passa a decidir pela origem já gravada. O handler de `views/visita.js` que gravava `digitacao` sai.
- Testes novos em `tests/store.test.mjs`: só voz, só digitação, voz e depois digitação (e o contrário), e o check-out com resultado que salva o núcleo, preserva `tempo_nucleo_s` e o registro "no ponto".

## E · README, changelog e versão

- README com "Campo Praso · V2.3", o link `https://case-praso.vercel.app/?demo=1`, sem o marcador da quarta, a seção "O que a plataforma mostra, pede e devolve", o passo 1 do laço na demonstração, a decisão 11 e as duas premissas novas na tabela.
- `CHANGELOG.md` com a entrada V2.3 (A a E) e `VERSAO` nova em `public/sw.js`.
- A frase "o mesmo domínio da V1; a V2 migra sozinha os dados do aparelho" depende de a V1 ter estado em `case-praso.vercel.app`, o que não consegui confirmar (o domínio antigo do README responde 404). Pergunta em aberto para o Arthur.

## Testes existentes com expectativa alterada

- `tests/motivos.test.mjs` → `preco`, `quer_prazo` e `vai_pensar` (de 11h para a janela das 14h).
- Nenhum outro teste existente muda de expectativa.

## O que foi feito

Os cinco ajustes saíram como planejado, com 101 testes passando (17 novos e 3 expectativas alteradas em `tests/motivos.test.mjs`). No seed, o funil do "Você" com o plano do dia gerado ficou em 87%, 58%, 70%, 73% e 65% por etapa (16,7% no total, em 3º no time), com 50% dos retornos na janela, e a rota de exemplo traz as duas ativações da exceção de manhã e a linha de intervalo antes das paradas da tarde. A verificação no navegador foi feita a 360 e 412 px, às 9h30, 10h, 13h, 15h e 20h, sem rolagem horizontal e sem erro no console.

**Uma mudança fora dos cinco pontos, aprovada pelo Arthur.** O passo 1 do README, como estava escrito, não funcionava em nenhum horário, porque o "+1 dia" do simulador mantinha a hora do relógio e o retorno marcado caía sempre num horário que, no dia seguinte, já tinha passado. Agora o "+1 dia" leva ao começo da jornada do dia seguinte (`views/sim.js`; os +7, +30 e +46 continuam iguais), `offsetDias` conta dias de calendário (`store.js`, para o selo do relógio não mostrar "+0" à noite) e o passo 1 usa a janela da manhã, que funciona das 9h em diante e à noite.

**Domínio.** O link de avaliação é `https://case-praso.vercel.app/?demo=1`. A frase de que a V2 está no mesmo domínio da V1 saiu do README, porque não deu para confirmar.

## Fora do escopo (anotado, não mudado)

- **Tempo de registro com o botão único.** Com "Salvar e fazer check-out", o fim do núcleo passa a ser o toque no check-out. Se o vendedor marcar o resultado no meio da visita e sair minutos depois, o tempo de registro (H1) cresce na mesma medida. Ficou como está, por decisão do Arthur; a alternativa é medir até o último toque nos chips do núcleo.
- **Retorno no mesmo dia.** Um ponto visitado hoje com retorno marcado para mais tarde, no mesmo dia, não volta para a rota de hoje nem para o chip de retornos, porque o plano trata como feito tudo o que foi visitado no dia. O laço só aparece na rota a partir do dia seguinte.
- **Seed.** Para caber nas faixas da tese, o seed passou a ter menos pontos cadastrados (70 contra 107) e mais leads visitados. A carteira de exemplo continua com 210 pontos, mas com menos ativações e churns do que a V2.2.
