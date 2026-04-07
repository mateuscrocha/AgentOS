---
name: painel
description: Opera o Git do Boris Painel a partir do workspace oficial dentro do AgentOS
---

Use sempre o workspace oficial do painel:

`/Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel`

Parse `$ARGUMENTS`:
- primeira palavra = `acao`
- restante = `resto`

Valide que o workspace existe e que e um repositorio Git.

Comportamento por acao:

### `status`

Rode:
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel status --short --branch`
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel remote -v`

Explique ao usuario se o painel esta limpo, com mudancas locais, adiantado ou atrasado do remoto.

### `commit`

Exija mensagem de commit em `resto`. Se estiver vazia, informe o formato correto:

`/painel commit minha mensagem`

Antes de commitar, rode:
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel status --short`

Se nao houver mudancas, informe isso e pare.

Se houver mudancas:
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel add -A`
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel commit -m "$resto"`

Depois, mostre o hash curto e lembre que o commit pertence ao repositorio `boris-admin-core`.

### `push`

Rode:
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel push origin main`

Confirme o branch enviado e o remoto.

### `pull`

Rode:
- `git -C /Users/eu.rochamateus/Documents/Codex/AgentOS/spaces/boris/areas/produto/workspaces/boris-painel pull --ff-only origin main`

Depois rode:
- `git status --short -- spaces/boris/areas/produto/workspaces/boris-painel`

Se o ponteiro do submodulo no AgentOS tiver mudado, avise explicitamente que o repo pai agora precisa de um commit para registrar a nova referencia do painel.

### Erros de uso

Se `acao` nao for `status`, `commit`, `push` ou `pull`, explique o uso correto com exemplos:

```bash
/painel status
/painel commit ajusta rota de usuarios
/painel push
/painel pull
```
