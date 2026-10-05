# Campo Praso · V1

V1 da plataforma de campo do case RevOps da Praso. Arthur Aragão, outubro de 2026.

## O que é e por que existe

A V1 é o meu **instrumento de pesquisa de campo** e o primeiro teste das hipóteses sobre o vendedor. Quem usa sou eu, visitando de 8 a 10 estabelecimentos em Recife como se fosse vendedor da Praso.

Ela não é o protótipo final do case. O protótipo final é a V2, construída depois do campo com o que eu aprender na rua. A V1 tem três exigências:

- ser rápida de construir (timebox de 3 a 4 horas);
- ser confiável na rua: funcionar offline, com uma mão e no sol;
- usar **o mesmo modelo de dados da V2**, para que o dado de campo vire a base real da V2.

O que a V1 testa:

| Hipótese | Requisitos | O que a V1 mede |
| --- | --- | --- |
| **H1** · o vendedor só registra se o registro devolver algo para ele | RF06, RF10, RF11 | Tempo do núcleo de 3 toques e se ele foi salvo no ponto ou depois |
| **H2** · o pino errado no mapa é problema de dado, não de mapa | RF05, RF12, script | Distância entre o endereço do CNPJ e o GPS do check-in |
| **H3** · registrar por voz é melhor que preencher formulário | RF08, RF11 | Chip "registrei por voz ou digitação" e legibilidade das notas |
| **Tese do laço** · o registro de hoje muda o dia seguinte | RF06, RF10 | Revisitas, desvio em relação ao horário sugerido e se o decisor estava |
| **H4, H5, H6** · o lado do comprador | RF07 | Pagamento, número de fornecedores, canal e frequência de compra (só registra) |

## Fluxo

1. **Lista do dia:** pontos em três seções. "Retornar" vem primeiro, ordenado pelo horário sugerido. Cada cartão tem um botão "Rota", que abre o Google Maps.
2. **Cadastrar ponto:** antes de sair, pela lista. Na rua, use "+ Ponto aqui", que cria o ponto a partir do GPS e já faz o check-in.
3. **Check-in:** a visita é criada na hora. A posição GPS e a precisão em metros são gravadas quando chegam, e nada espera o GPS.
4. **Observação** (antes de entrar), seguida do **registro em 3 toques**: resultado, quem decide e quando o decisor está. Há também um chip para a versão da conversa. Depois, toque em "Salvar registro".
5. **Pesquisa** (opcional): as perguntas 1 a 8, na ordem exata do roteiro de campo.
6. **Check-out:** depois dele, a visita continua editável. Ainda falta preencher "o que me surpreendeu aqui" e o chip de voz ou digitação.
7. **Laço:** se o decisor não estava e a janela dele foi registrada, ou se houve um melhor horário combinado no fechamento, o ponto vai sozinho para "Retornar". O horário sugerido é a próxima ocorrência da janela.
8. **Exportar:** o botão fica sempre no topo. Gera CSV (uma linha por visita) e JSON (tudo). A regra é exportar ao fim de cada dia de campo.

## Decisões e trade-offs

**1. Registro em dois blocos.** O núcleo de 3 toques é o que o vendedor da Praso faria, e o tempo dele é medido à parte. O bloco de pesquisa é opcional e serve ao case.
- *Ganho:* o teste de H1 não é contaminado pelo questionário.
- *Custo:* a tela fica longa. Por isso a pesquisa vem recolhida e o núcleo fica num cartão em destaque.
- *Detalhe:* "quem decide" aparece só no núcleo. A pergunta 2 do roteiro registra apenas quem paga e quem recebe, para não duplicar o campo.

**2. Voz sem código.** O ditado do teclado do Android já funciona em qualquer campo de texto, então a V1 só tem textos e o chip de voz ou digitação. Não usa a Web Speech API.
- *Ganho:* zero integração e nada que quebre offline.
- *Custo:* não há transcrição estruturada por IA. Isso fica para a V2, se H3 sobreviver ao barulho de cozinha.
- *Detalhe:* acrescentei a opção "os dois", porque na prática as notas misturam ditado e digitação.

**3. H2 fora do app.** O app grava o CNPJ (opcional) e o GPS do check-in, sem geocodificar endereço. A comparação é feita depois, em lote, por `scripts/h2_distancias.mjs`.
- *Ganho:* tira duas APIs externas (Receita e geocodificador) do caminho crítico da visita.
- *Custo:* o achado só aparece depois do campo.

**4. A entidade central é o ponto físico com estado.** O ponto tem estado no funil (lead, oportunidade, cliente, churn), e as visitas ficam penduradas nele por `ponto_id`. Não existe "lead que vira conta". É a principal descoberta da auditoria do Salesforce e é o modelo da V2.
- Refinos sobre a proposta inicial:
  - "quem decide" e a janela do decisor também ficam no ponto, com o valor da última visita, porque são atributos do lugar e a V2 lê sem varrer visitas;
  - o ponto guarda o motivo do retorno (janela do decisor ou horário combinado);
  - o pino do ponto passa a ser o do check-in (`coord_fonte`);
  - a visita guarda `retorno_previsto`, para medir se a revisita no horário sugerido encontrou o decisor.

**5. Offline-first, com localStorage em vez de IndexedDB.** Cada toque grava o estado inteiro no aparelho, de forma síncrona.
- *Ganho:* o dado está salvo no instante do toque, e fechar a aba logo depois não perde nada. O volume de campo (dezenas de visitas) é minúsculo.
- *Custo:* o limite fica em torno de 5 MB e a gravação reescreve o estado inteiro. É irrelevante na V1 e deve ser trocado na V2, quando houver backend.
- *Robustez:* toda leitura e escrita tem try/catch. Sem armazenamento, o app segue em memória e avisa em vermelho. Um JSON corrompido não é descartado (fica uma cópia guardada). O app também pede `navigator.storage.persist()` e permite importar um backup JSON.

**6. Privacidade.** O app não coleta nome nem telefone pessoal do dono. Dados reais nunca vão para o repositório: o `.gitignore` bloqueia `*.csv` e os exports, e os exemplos são fictícios e removíveis num toque.

**7. Stack: HTML, CSS e JS puros, sem framework e sem build.** Foram cogitados React e Node.
- Na V1, o que pode dar errado na rua é perder registro, travar sem sinal ou ficar lento, e um framework não resolve nenhum dos três.
- Um framework acrescentaria build e plugin de service worker, que é a parte mais fácil de quebrar offline.
- O Node entrou onde aumenta a robustez: nos testes automáticos (`node --test`) e no script de H2.
- React faz sentido na V2, quando entram a visão do gestor, a recorrência e a pontuação.

**8. Mapa embutido (RF04) não entrou.** Os tiles do OpenStreetMap exigem rede, então o mapa não funcionaria justamente no modo avião, e o link "Rota" para o Google Maps já resolve a navegação.
- *Custo:* não há visão espacial do dia dentro do app.
- É candidato à V2, junto com a rota otimizada.

**Medição (RF11).** Os horários são gravados brutos, e as durações saem calculadas no export.
- **Tempo no ponto:** do check-in ao check-out.
- **Tempo do núcleo:** do primeiro toque do núcleo até "Salvar registro". O chip de versão da conversa não conta.
- **Tempo da pesquisa:** do primeiro ao último toque no bloco. É quase o tempo da conversa, não o tempo de registro, então serve ao diário de bordo e não entra como evidência de H1.
- **`nucleo_salvo_no_ponto`:** indica se o núcleo foi salvo antes do check-out. É o "feito no ponto, e não depois" de H1.

## Estrutura

```
public/                 o app (é o que vai ao ar)
  index.html, styles.css, sw.js, manifest.webmanifest, icon.svg
  js/catalogo.js        opções dos chips (chave vai ao export, rótulo vai à tela)
  js/rules.js           regras puras: próxima janela (RF10), durações (RF11), distância
  js/store.js           modelo de dados, persistência, laço de retorno, schema_version
  js/export.js          CSV e JSON (RF12)
  js/geo.js, js/ui.js   GPS e utilitários de tela
  js/views/             lista do dia, ponto (cadastro e ficha), visita
  js/seed.js            dados fictícios de exemplo
tests/                  node --test: regras, store e export
scripts/h2_distancias.mjs   teste de H2 em lote a partir do export JSON
```

## Como rodar e publicar

Para usar no computador:

```bash
npm test                 # 29 testes, sem dependências
npm run dev              # serve public/ em http://localhost:5173
```

O GPS só funciona em HTTPS ou em `localhost`. Para testar no celular, use o link publicado.

**Publicar na Vercel**, por qualquer um destes caminhos:

- **CLI:** na pasta do repositório, rode `npx vercel --prod`. Na primeira vez, ela pede login e cria o projeto.
- **GitHub:** suba o repositório e importe em vercel.com/new. O `vercel.json` já define que não há build e que a pasta publicada é `public`.

**Atualizar:** troque `VERSAO` em `public/sw.js` a cada deploy. O service worker serve do cache e baixa a versão nova em segundo plano, então ela aparece no segundo carregamento.

**Teste de H2 depois do campo** (precisa de internet):

```bash
node scripts/h2_distancias.mjs praso-campo-AAAAMMDD-HHMM.json h2_resultado.csv
```

O script usa a BrasilAPI para buscar o endereço do CNPJ e o Nominatim (OpenStreetMap, 1 requisição por segundo) para geocodificar. O resultado tem a distância em metros e a coluna `acima_100m`.

## Dados fictícios

Para conhecer o app, use Exportar → Mais opções → "Carregar pontos fictícios de exemplo". Ele cria seis pontos inventados ("Lanchonete Exemplo A" a "Bar Exemplo F"), com ruas fictícias no "Bairro Exemplo" e coordenadas aproximadas do centro do Recife, só como referência. Uma visita de exemplo mostra o laço: decisor ausente e janela das 6h às 9h, então o ponto aparece em "Retornar" no próximo horário das 6h. O CNPJ de exemplo, 99.999.999/0001-99, é inválido de propósito.

Para apagar tudo isso, use "Remover pontos fictícios". Os dados reais não são tocados.

## Formato do export

O **JSON** é o estado completo:

```json
{ "schema_version": 1, "exportado_em": "...", "pontos": [ ... ], "visitas": [ ... ] }
```

O **CSV** tem uma linha por visita, com os dados do ponto na mesma linha.
- Separador `;` e BOM UTF-8, para abrir direto no Excel em português. O Google Sheets detecta o separador sozinho.
- Listas aparecem separadas por `|`.
- Horários estão em hora local, e durações em segundos.
- Pontos sem visita não geram linha no CSV, mas estão no JSON.

## Fora da V1

Login e múltiplos usuários, backend e sincronização, pontuação de aquisição, recorrência e mensagem de WhatsApp, enriquecimento automático (Google Places, Receita), rota otimizada, visão do gestor, mapa embutido e acabamento visual. Tudo isso é candidato à V2.
