# Proposta · cruzamento Receita + mapa aberto (fatia 9, não executada)

Esta fatia era opcional, com limite de 3 horas. Ficou como proposta. No protótipo, a fila Descobrir e a camada "Desconhecidos" usam desconhecidos **fictícios** do seed, no mesmo formato que este pipeline geraria.

## Saída esperada

A saída é um JSON estático `public/demo/desconhecidos.json`, com uma lista de:

```json
{ "id", "grupo": "receita | mapa_aberto | baixa_confianca", "nome", "tipo", "bairro",
  "cnpj?", "mei?", "endereco", "lat", "lng", "confianca?", "fonte" }
```

## Passos (script único em `scripts/`, roda uma vez)

1. **Base de CNPJ.**
   - Baixar os dados abertos de Estabelecimentos e do Simples, da Receita Federal (atualização mensal).
   - Filtrar pelo município de Recife e pelos CNAEs do ICP: 5611-2/01, 5611-2/03, 5611-2/04, 5611-2/05, 4721-1/02, 1091-1/02 e 5620-1/04.
   - Ficar só com situação ativa e marcar MEI pelo Simples.
2. **Mapa aberto.** Baixar os places do Overture Maps (licença CDLA-Permissive 2.0) para a caixa geográfica de Boa Viagem, Pina e Imbiribeira, nas categorias de alimentação.
3. **Geocodificação** do endereço da Receita, pela base CNEFE (pacote geocodebr) ou por um serviço aberto. Guardar a precisão (número, rua ou CEP).
4. **Casamento.** Combinar o nome normalizado, com a mesma similaridade por bigramas de `rules.js → similaridade`, e a distância.
   - O score é `0,6 × similaridade + 0,4 × (1 − distância / 150 m)`.
   - Limiares configuráveis: a partir de 0,75 conta como casado; entre 0,45 e 0,75, como baixa confiança.
   - Os grupos resultantes são: casado, só Receita e só mapa.
5. **Saída.** Os pontos casados que já estão na carteira são ignorados. O resto vira os três grupos da fila Descobrir.

## Privacidade (inegociável)

- Não extrair telefone, e-mail nem nomes de sócios.
- Não commitar o dump bruto, que fica em `dados/` e é bloqueado no `.gitignore`.
- Commitar só o JSON final dos bairros, se a licença permitir, ou um recorte anonimizado.

## Por que vale a pena

A distância medida em H2 entre o endereço do CNPJ e o GPS do check-in dimensiona o problema do "pino errado". Este cruzamento faz a mesma coisa de forma preventiva: mostra antes da visita quais pinos são de baixa confiança.
