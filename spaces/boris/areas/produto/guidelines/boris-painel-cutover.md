# Boris Painel Cutover

## Decisao

O workspace canonico do Boris Painel passa a ser:

`spaces/boris/areas/produto/workspaces/boris-painel/`

Esse e o local oficial para:

- desenvolvimento do app
- build e testes
- manutencao de Edge Functions
- evolucao tecnica do produto

## Origem legada

O repositorio historico em:

`/Users/eu.rochamateus/Documents/Codex/Bóris - Painel`

passa a ser tratado como referencia legada de transicao, nao como origem principal de trabalho.

## Regra operacional

- novas alteracoes no painel devem partir do workspace dentro do AgentOS
- validacoes locais devem rodar a partir do workspace importado
- `.env` local do workspace importado pode ser mantido alinhado ao ambiente antigo enquanto durar a transicao
- documentacao funcional e tecnica do app deve ser atualizada primeiro no workspace importado

## Quando usar o repo legado

O repo legado so deve ser usado temporariamente para:

- consultar historico local ainda nao absorvido pelo AgentOS
- comparar estado antigo durante a transicao
- recuperar algum arquivo ou configuracao que nao tenha sido trazido

## Proibicoes praticas

- nao abrir novas frentes de implementacao no repo legado
- nao tratar o repo legado e o workspace importado como duas fontes ativas em paralelo
- nao manter divergencia deliberada entre os dois

## Estado atual do cutover

No momento desta formalizacao, o workspace importado ja foi validado com:

- `npm run build`
- `npm test`
- `npm run test:screenshot`

Portanto, ele ja pode ser operado como base principal do produto.
