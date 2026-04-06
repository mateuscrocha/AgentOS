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

passa a ser absorvido operacionalmente pelo workspace do AgentOS via `git submodule`, nao como pasta local separada de uso diario.

## Regra operacional

- novas alteracoes no painel devem partir do workspace dentro do AgentOS
- validacoes locais devem rodar a partir do workspace importado
- o caminho `spaces/boris/areas/produto/workspaces/boris-painel/` e o unico checkout local que precisa ser usado no dia a dia
- documentacao funcional e tecnica do app deve ser atualizada primeiro no workspace importado

## Como o Git fica organizado

- o AgentOS versiona apenas o ponteiro do submodulo
- o codigo do painel, seus commits e seu remoto vivem em `mateuscrocha/boris-admin-core`
- o workspace do painel dentro do AgentOS deve apontar para o branch `main` desse repositorio
- a pasta local antiga fora do AgentOS deixa de ser necessaria apos a migracao

## Proibicoes praticas

- nao abrir novas frentes de implementacao na pasta local antiga fora do AgentOS
- nao tratar a pasta antiga e o workspace importado como duas fontes ativas em paralelo
- nao manter divergencia deliberada entre os dois

## Estado atual do cutover

No momento desta formalizacao, o workspace importado ja foi validado com:

- `npm run build`
- `npm test`
- `npm run test:screenshot`

Portanto, ele ja pode ser operado como base principal do produto.
