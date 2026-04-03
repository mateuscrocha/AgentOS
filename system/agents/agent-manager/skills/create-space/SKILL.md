---
name: create-space
description: Cria um novo space com toda a estrutura de diretórios e memória
agent: agent-manager
version: 3.0
---

# Skill: create-space

## Inputs

- `space_name`: Nome do space (kebab-case)

## Processo

1. **Validar** que não existe space com o mesmo nome em `spaces/`
2. **Criar** diretório `spaces/{space_name}/` com subdiretórios: `areas/`, `memory/`, `guidelines/`
3. **Aplicar** template `system/templates/space/SPACE.md.template` — substituir placeholders conforme template
4. **Perguntar ao usuário** sobre propósito do space para preencher o SPACE.md
5. **Criar** `guidelines/GUIDELINES.md` usando template `system/templates/guidelines/GUIDELINES.md.template` com `{{SCOPE_TYPE}}` = space
6. **Criar** `memory/world.md` com estado inicial e `memory/handoff.md` com header
7. **Finalizar:** atualizar `registry.md`, `system/memory/world.md`, registrar `space.created` em `bus.md`, atualizar `history.md`

## Output

Confirmação com caminho do space e próximos passos: `/new-area {space} <nome>`
