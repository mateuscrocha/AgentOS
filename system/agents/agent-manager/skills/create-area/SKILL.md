---
name: create-area
description: Cria uma nova area dentro de um space existente
agent: agent-manager
version: 2.0
---

# Skill: create-area

## Inputs

- `space_name`: Nome do space (deve existir em `spaces/`)
- `area_name`: Nome da area (kebab-case)

## Processo

1. **Validar** que o space existe e que não existe area com o mesmo nome
2. **Criar** diretório `spaces/{space_name}/areas/{area_name}/` com subdiretórios: `agents/`, `teams/`, `memory/`, `guidelines/`
3. **Aplicar** template `system/templates/area/AREA.md.template` — substituir placeholders conforme template
4. **Perguntar ao usuário** sobre propósito da area para preencher o AREA.md
5. **Criar** `guidelines/GUIDELINES.md` usando template `system/templates/guidelines/GUIDELINES.md.template` com `{{SCOPE_TYPE}}` = area, herança apontando para space
6. **Criar** `memory/world.md` com estado inicial e `memory/handoff.md` com header
7. **Finalizar:** atualizar `SPACE.md` (tabela de areas), `registry.md`, registrar `area.created` em `bus.md`, atualizar `history.md`

## Output

Confirmação com caminho da area e próximos passos: `/new-agent {space} {area} <nome>` ou `/new-team {space} {area} <nome>`
