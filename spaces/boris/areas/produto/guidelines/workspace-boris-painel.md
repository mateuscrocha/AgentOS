# Workspace: Boris Painel

## Papel

`spaces/boris/areas/produto/workspaces/boris-painel/` e o workspace oficial do aplicativo principal do Boris dentro do AgentOS.

Ele concentra:

- codigo frontend do painel
- Edge Functions e configuracao Supabase ligadas ao produto
- testes de interface e fluxos E2E
- documentacao tecnica do app

## Regra de organizacao

- `guidelines/` e `memory/` da area `produto` continuam sendo a camada de decisao e contexto operacional
- `workspaces/boris-painel/` e a camada executavel do produto
- materiais editoriais, assets de campanha e acervo de conteudo continuam em `spaces/boris/resources/`

## Operacao

- o repositorio foi importado com historico Git preservado via `git subtree`
- alteracoes no painel devem acontecer dentro do workspace
- documentacao estavel de produto, fluxo, decisao ou operacao deve ser promovida para `guidelines/` quando deixar de ser apenas detalhe de implementacao

## Limites

- nao usar o workspace do painel como deposito geral de arquivos do Boris
- nao mover memoria do space ou da area para dentro do app
- manter secrets fora do repositorio e seguir o padrao de `.env.example` do proprio painel
