---
name: create-team
description: Cria um novo time dentro de uma area, com memória e comunicação
agent: team-manager
version: 3.0
---

# Skill: create-team

## Inputs

- `space_name`: Nome do space
- `area_name`: Nome da area
- `team_name`: Nome do time (kebab-case)

## Processo

1. **Validar** que a area existe e que o nome do time é único na area
2. **Criar** diretório `spaces/{space_name}/areas/{area_name}/teams/{team_name}/` com subdiretórios: `memory/`, `agents/`, `guidelines/`
3. **Aplicar** template `system/templates/team/TEAM.md.template` — substituir placeholders conforme template
4. **Perguntar ao usuário** sobre propósito do time, membros e líder
5. **Criar** `guidelines/GUIDELINES.md` usando template `system/templates/guidelines/GUIDELINES.md.template` com `{{SCOPE_TYPE}}` = time, herança apontando para area e space
6. **Invocar memory-manager** para inicializar memória do time (`world.md`, `handoff.md`)
7. **Atualizar** AGENT.md de cada membro com campo `team: {team_name}`
8. **Finalizar:** atualizar `AREA.md` (tabela de times), `team-registry.md`, registrar `team.created` em `bus.md`, atualizar `history.md`

## Output

Confirmação com membros, líder e memória inicializada
