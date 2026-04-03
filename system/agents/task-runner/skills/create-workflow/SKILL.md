---
name: create-workflow
description: Cria definição reutilizável de workflow em system/workflows/
agent: task-runner
version: 1.0
---

# Skill: create-workflow

## O que esta skill faz

Cria uma definição de workflow reutilizável que pode ser executada com `/run <nome>`.

## Quando usar

- Quando o usuário quer salvar um padrão de operações para reutilização
- Quando o workflow-planner identifica um padrão recorrente

## Inputs

- `$NAME`: Nome do workflow
- `$DESCRIPTION`: O que o workflow faz
- `$STEPS`: Lista de passos com agentes, ações e dependências

## Processo

1. **Validar nome** — verificar que não existe workflow com o mesmo nome em `system/workflows/`

2. **Criar arquivo** `system/workflows/{nome}.md` no formato:

```markdown
---
name: {nome}
description: {descrição}
version: 1.0
created: {data}
---

# Workflow: {nome}

## Parâmetros

| Param | Obrigatório | Descrição |
|---|---|---|
| {param} | Sim/Não | {descrição} |

## Passos

| # | Agente | Ação | Dependências | Paralelo |
|---|---|---|---|---|
| 1 | agent-manager | create-space | — | Não |
| 2 | agent-manager | create-area | 1 | Não |
| 3 | memory-manager | init-memory | 2 | Sim (com 4) |
| 4 | skill-manager | create-skill | 2 | Sim (com 3) |
```

3. **Registrar** em `history.md`

## Output

Confirmação com path do workflow criado e instruções de uso.

## Regras

1. Nomes de workflow devem ser kebab-case (ex: `setup-full-space`)
2. Cada passo deve referenciar um agente e skill que existam
3. Dependências devem ser válidas (não referenciar passos inexistentes)
