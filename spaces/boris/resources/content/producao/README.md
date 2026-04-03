# Producao de Conteudo

Este diretorio passa a ser a base unica de organizacao dos packs de conteudo do Bóris.

## Estrutura

- `posts/`: uma pasta por post ou cena
- `campanhas/`: uma pasta por campanha, com desdobramento por dia quando necessario
- `materiais/`: uma pasta por material de apoio, deck, doc ou kit
- `_templates/`: modelos-base para iniciar novas pastas com consistencia

## Convencao de nomes

Use sempre:

- `YYYY-MM-DD-slug-curto`

Exemplos:

- `2026-03-25-cabeca-quente`
- `2026-03-25-grupo-ativo-engana`
- `2026-03-25-demo-resumo-mobile`

## Regra operacional

Cada pedido novo deve gerar ou atualizar uma unica pasta-fonte.

Tudo que pertence ao mesmo item deve ficar junto:

- roteiro
- copy
- prompts
- locucao
- plano de video
- checklist de assets

Nao espalhar arquivos do mesmo item em lugares diferentes.

## Acervo incorporado

Packs anteriores que ja fazem parte do acervo local podem continuar na raiz de `producao` quando ainda estiverem fora dos subtipos `posts`, `campanhas` ou `materiais`.

Daqui para frente, novos itens devem nascer em:

- `producao/posts`
- `producao/campanhas`
- `producao/materiais`
